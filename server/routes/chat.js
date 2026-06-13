// server/routes/chat.js
// Roadmap Wave 7 (final): DeepSeek-powered AI assistant. Mounted in index.js as:
//   app.use('/api/chat', requireAuth, chatRouter)
//
// Conversations are CRUD'd via the chat.model; POST /send streams the model's reply
// back over Server-Sent Events (SSE) token-by-token. Dual backend: the cloud
// DeepSeek API (OpenAI-compatible, same auth pattern as Wave 6 embeddings.js) or a
// local Ollama instance for the on-device R1 model.
//
// NOTE on errors: once the SSE headers are written we can no longer produce a JSON
// error envelope, so streaming failures are emitted as a `{ type: 'error' }` SSE
// event and the outer catch guards on res.headersSent before delegating to next().

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { aiUpstreamDuration } from '../lib/metrics.js';
import {
  listConversations,
  getConversationById,
  createConversation,
  updateConversation,
  deleteConversation,
  getContextForConversation,
} from '../models/chat.model.js';

const router = Router();

// ─── Available models ────────────────────────────────────────────────────────
// Single source of truth for all model configuration. Frontend reads labels via
// GET /api/chat/models; backend uses modelMeta.apiModel for the actual API call.
// DeepSeek V4 family (2026-07-24 sunset deadline for legacy deepseek-chat/reasoner).
const MODELS = {
  'deepseek-v4-flash': { label: 'DeepSeek V4 Flash',   provider: 'cloud',  apiModel: 'deepseek-v4-flash' },
  'deepseek-v4-pro':   { label: 'DeepSeek V4 Pro',     provider: 'cloud',  apiModel: 'deepseek-v4-pro' },
  'deepseek-r1-local': { label: 'DeepSeek R1 (Local)', provider: 'ollama', apiModel: 'deepseek-r1:7b' },
};
const MODEL_IDS = Object.keys(MODELS);

// ─── Provider config (shares DEEPSEEK_API_KEY with Wave 6 embeddings) ─────────
const DEEPSEEK_API_KEY  = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const OLLAMA_BASE_URL   = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// ─── Zod schema ───────────────────────────────────────────────────────────────
const sendMessageSchema = z.object({
  conversation_id:     z.number().int().positive().optional().nullable(),
  message:             z.string().min(1).max(10000),
  model:               z.enum(MODEL_IDS).optional().default('deepseek-v4-flash'),
  temperature:         z.number().min(0).max(2).optional().default(0.7),
  top_p:               z.number().min(0).max(1).optional().default(0.9),
  context_entity_type: z.string().max(40).optional().nullable(),
  context_entity_id:   z.number().int().positive().optional().nullable(),
});

// ─── GET /api/chat/models ─────────────────────────────────────────────────────
router.get('/models', (_req, res) => {
  const models = Object.entries(MODELS).map(([id, meta]) => ({
    id,
    label: meta.label,
    provider: meta.provider,
    available: meta.provider === 'ollama' ? true : Boolean(DEEPSEEK_API_KEY),
  }));
  res.json({ success: true, data: models });
});

// ─── GET /api/chat/conversations ──────────────────────────────────────────────
router.get('/conversations', async (req, res, next) => {
  try {
    const { page, per_page } = req.query;
    const result = await listConversations(req.user.id, {
      page: parseInt(page, 10) || 1,
      per_page: Math.min(parseInt(per_page, 10) || 20, 50),
    });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/chat/conversations/:id ──────────────────────────────────────────
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Invalid conversation ID.', 400, 'VALIDATION_ERROR', 'id');
    }
    const convo = await getConversationById(req.user.id, id);
    if (!convo) throw new AppError('Conversation not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: convo });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/chat/conversations/:id ───────────────────────────────────────
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Invalid conversation ID.', 400, 'VALIDATION_ERROR', 'id');
    }
    const convo = await deleteConversation(req.user.id, id);
    if (!convo) throw new AppError('Conversation not found.', 404, 'NOT_FOUND');
    (req.log ?? logger).info({ event: 'CHAT_DELETE', userId: req.user.id, convoId: id, reqId: req.id }, `User ${req.user.id} deleted conversation ${id}`);
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/chat/send ──────────────────────────────────────────────────────
// Persists the user message, streams the assistant reply over SSE, then persists
// the assistant reply once the stream completes.
router.post('/send', validate(sendMessageSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { conversation_id, message, model, temperature, top_p, context_entity_type, context_entity_id } = req.body;

    // Backward-compat: map legacy model IDs from old conversations to V4 equivalents.
    // DeepSeek retires deepseek-chat / deepseek-reasoner on 2026-07-24.
    const MODEL_COMPAT = {
      'deepseek-chat':     'deepseek-v4-flash',
      'deepseek-chat-max': 'deepseek-v4-pro',
      'deepseek-reasoner': 'deepseek-v4-pro',
    };
    if (MODEL_COMPAT[model]) {
      model = MODEL_COMPAT[model];
    }

    const modelMeta = MODELS[model];
    if (!modelMeta) throw new AppError(`Unknown model: ${model}`, 400, 'VALIDATION_ERROR', 'model');

    // Get or create the conversation.
    let conversation;
    if (conversation_id) {
      conversation = await getConversationById(userId, conversation_id);
      if (!conversation) throw new AppError('Conversation not found.', 404, 'NOT_FOUND');
    } else {
      const title = message.slice(0, 100).replace(/\n/g, ' ');
      conversation = await createConversation(userId, {
        title,
        model,
        messages: [],
        context_entity_type: context_entity_type ?? null,
        context_entity_id: context_entity_id ?? null,
        temperature,
        top_p,
      });
    }

    // Build the running message list (JSONB comes back pre-parsed).
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];

    // On the first message of a context-linked conversation, inject the entity as
    // a system prompt so the model has the relevant context.
    if (messages.length === 0 && context_entity_type && context_entity_id) {
      const context = await getContextForConversation(userId, context_entity_type, context_entity_id);
      if (context) {
        messages.push({
          role: 'system',
          content: `You are an AI assistant integrated into Polymath OS. The user is working on: ${JSON.stringify(context)}. Use this context to provide relevant, personalized responses. Reference specific details from the context when helpful.`,
        });
      }
    }

    messages.push({ role: 'user', content: message });
    await updateConversation(userId, conversation.id, { messages });

    // ── Set up the SSE stream ────────────────────────────────────────────────
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering (nginx) for true streaming
    });
    res.write(`data: ${JSON.stringify({ type: 'conversation_id', id: conversation.id })}\n\n`);

    try {
      let fullResponse = '';
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

      if (modelMeta.provider === 'ollama') {
        const ollamaAbort = new AbortController();
        const ollamaTimeout = setTimeout(() => ollamaAbort.abort(), 120_000);
        const ollamaStart = Date.now();
        let ollamaStatus = 'success';
        try {
          const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelMeta.apiModel,
              messages: apiMessages,
              stream: true,
              options: { temperature, top_p },
            }),
            signal: ollamaAbort.signal,
          });
          if (!ollamaRes.ok || !ollamaRes.body) {
            ollamaStatus = String(ollamaRes.status);
            throw new Error(`Ollama unavailable (${ollamaRes.status}). Is Ollama running with deepseek-r1:7b pulled?`);
          }

          const reader = ollamaRes.body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n').filter(l => l.trim())) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  fullResponse += json.message.content;
                  res.write(`data: ${JSON.stringify({ type: 'token', content: json.message.content })}\n\n`);
                }
              } catch { /* skip non-JSON keep-alive lines */ }
            }
          }
        } catch (err) {
          if (err.name === 'AbortError' || err.code === 'ABORT_ERR') ollamaStatus = 'timeout';
          else if (ollamaStatus === 'success') ollamaStatus = 'error';
          throw err;
        } finally {
          clearTimeout(ollamaTimeout);
          aiUpstreamDuration.observe(
            { provider: 'ollama', model: modelMeta.apiModel, status: ollamaStatus },
            (Date.now() - ollamaStart) / 1000
          );
        }
      } else {
        // Cloud DeepSeek API.
        if (!DEEPSEEK_API_KEY) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'DEEPSEEK_API_KEY is not configured. Set it in your environment to use cloud models.' })}\n\n`);
          res.end();
          return;
        }

        const cloudAbort = new AbortController();
        const cloudTimeout = setTimeout(() => cloudAbort.abort(), 60_000);
        const cloudStart = Date.now();
        let cloudStatus = 'success';
        try {
          const apiModel = modelMeta.apiModel;
          const apiRes = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({ model: apiModel, messages: apiMessages, temperature, top_p, stream: true }),
            signal: cloudAbort.signal,
          });

          if (!apiRes.ok || !apiRes.body) {
            cloudStatus = apiRes.ok ? 'no_body' : String(apiRes.status);
            const errText = await apiRes.text().catch(() => '');
            res.write(`data: ${JSON.stringify({ type: 'error', message: `API error: ${apiRes.status} - ${errText}` })}\n\n`);
            res.end();
            return;
          }

          const reader = apiRes.body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n').filter(l => l.trim() && l.startsWith('data: '))) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
                }
              } catch { /* skip partial/non-JSON frames */ }
            }
          }
        } catch (err) {
          if (err.name === 'AbortError' || err.code === 'ABORT_ERR') cloudStatus = 'timeout';
          else if (cloudStatus === 'success') cloudStatus = 'error';
          throw err;
        } finally {
          clearTimeout(cloudTimeout);
          aiUpstreamDuration.observe(
            { provider: 'deepseek', model: modelMeta.apiModel, status: cloudStatus },
            (Date.now() - cloudStart) / 1000
          );
        }
      }

      // Persist the assistant reply.
      messages.push({ role: 'assistant', content: fullResponse });
      await updateConversation(userId, conversation.id, { messages });

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

      (req.log ?? logger).info(
        { event: 'CHAT_MESSAGE', userId, convoId: conversation.id, model, responseLength: fullResponse.length, reqId: req.id },
        `User ${userId} sent chat message in conversation ${conversation.id}`
      );
    } catch (streamErr) {
      const isAbort = streamErr.name === 'AbortError' || streamErr.code === 'ABORT_ERR';
      const message = isAbort
        ? 'AI request timed out. Try again or switch to the local model.'
        : streamErr.message;
      (req.log ?? logger).error({ err: streamErr, reqId: req.id }, 'Chat stream error');
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }

    res.end();
  } catch (err) {
    // If the SSE headers were already sent, we can't produce a JSON envelope —
    // just close the stream so the error handler never throws on sent headers.
    if (res.headersSent) {
      try { res.end(); } catch { /* already closed */ }
      return;
    }
    next(err);
  }
});

export { router as chatRouter };
export default router;
