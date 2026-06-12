// client/src/pages/AIChat.jsx
// Roadmap Wave 7 (final): the AI Chatbox — a DeepSeek-powered assistant.
// Left: conversation list. Center: streaming chat. Top: model + sampling controls.
// Streaming uses a raw fetch (not the axios `api` client) so we can read the SSE
// ReadableStream token-by-token; everything else goes through `api`.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Plus, Trash2, Copy, Bookmark, MessageSquare, Settings, Cpu } from 'lucide-react';

import api from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';

// Raw fetch needs an absolute base in dev (client :5173 → API :3000); same value
// the axios client uses. In production this resolves to the same origin.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MODEL_LABELS = {
  'deepseek-chat': 'V4 Pro',
  'deepseek-chat-max': 'V4 Pro Max',
  'deepseek-r1-local': 'R1 (Local)',
};
const MODEL_COLORS = {
  'deepseek-chat': 'moss',
  'deepseek-chat-max': 'ember',
  'deepseek-r1-local': 'terracotta',
};

// Research content column is capped at 10k; keep "Save to Research" within bounds.
const RESEARCH_CONTENT_MAX = 10000;

export default function AIChat() {
  useDocumentTitle('AI Chat');
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Context entity (from an "Ask AI" deep link, e.g. ?context=book&id=5). Held in
  // state so "New Chat" can clear it; injected only when starting a fresh chat.
  const [contextType, setContextType] = useState(() => searchParams.get('context'));
  const [contextId, setContextId] = useState(() => searchParams.get('id'));

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const result = await api.get('/api/chat/conversations');
      const data = result.data ?? [];
      setConversations(data);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load. fetchConversations sets loading/data state asynchronously; this is
  // the sanctioned data-fetch-in-effect pattern (same as useApi.js).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cmd/Ctrl+J focuses the chat input from anywhere on the page (FIX 4c).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectConversation = async (convo) => {
    try {
      const full = await api.get(`/api/chat/conversations/${convo.id}`);
      setActiveConvo(full.data);
      setMessages(Array.isArray(full.data.messages) ? full.data.messages : []);
      if (full.data.model) setModel(full.data.model);
      if (full.data.temperature != null) setTemperature(Number(full.data.temperature));
      if (full.data.top_p != null) setTopP(Number(full.data.top_p));
      // An existing conversation already has its context baked in.
      setContextType(null);
      setContextId(null);
    } catch {
      addToast({ type: 'error', title: 'Failed to load conversation' });
    }
  };

  const newChat = () => {
    setActiveConvo(null);
    setMessages([]);
    setInput('');
    setContextType(null);
    setContextId(null);
    inputRef.current?.focus();
  };

  const removeConversation = async (id) => {
    try {
      await api.delete(`/api/chat/conversations/${id}`);
      if (activeConvo?.id === id) newChat();
      fetchConversations();
      addToast({ type: 'success', title: 'Conversation deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete' });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    const userMessage = input.trim();
    const isNew = !activeConvo;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversation_id: activeConvo?.id ?? null,
          message: userMessage,
          model,
          temperature,
          top_p: topP,
          // Only inject context when kicking off a brand-new context-linked chat.
          context_entity_type: isNew && contextType ? contextType : null,
          context_entity_id: isNew && contextId ? parseInt(contextId, 10) : null,
        }),
      });

      if (!response.ok || !response.body) {
        addToast({ type: 'error', title: 'Failed to send message', message: `Server responded ${response.status}` });
        setMessages(prev => prev.filter(m => !m.streaming));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let newConvoId = activeConvo?.id ?? null;

      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'conversation_id') {
              newConvoId = data.id;
            } else if (data.type === 'token') {
              assistantContent += data.content;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantContent };
                }
                return updated;
              });
            } else if (data.type === 'done') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, streaming: false };
                }
                return updated;
              });
            } else if (data.type === 'error') {
              addToast({ type: 'error', title: 'AI error', message: data.message });
            }
          } catch { /* ignore partial / non-JSON frames */ }
        }
      }

      // Refresh the sidebar and promote a newly-created conversation to active.
      const list = await fetchConversations();
      if (newConvoId && isNew) {
        const found = list.find(c => c.id === newConvoId);
        setActiveConvo(found ?? { id: newConvoId });
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to send message' });
      setMessages(prev => prev.filter(m => !m.streaming));
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      addToast({ type: 'success', title: 'Copied to clipboard' });
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'Clipboard is unavailable.' });
    }
  };

  const saveToResearch = async (content) => {
    try {
      await api.post('/api/research', {
        title: content.slice(0, 200).replace(/\n/g, ' ').trim() || 'AI chat note',
        content: content.slice(0, RESEARCH_CONTENT_MAX),
        type: 'note',
        status: 'draft',
      });
      addToast({ type: 'success', title: 'Saved to Research' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to save', message: err.message });
    }
  };

  const visibleMessages = messages.filter(m => m.role !== 'system');
  const activeContextType = activeConvo?.context_entity_type ?? (contextType || null);
  const activeContextId = activeConvo?.context_entity_id ?? (contextId || null);

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] lg:h-dvh p-4 gap-4">
        <Skeleton className="w-64 lg:w-80 h-full" />
        <Skeleton className="flex-1 h-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-4 pt-8">
        <ErrorState message={error} onRetry={fetchConversations} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] lg:h-dvh overflow-hidden">

      {/* SIDEBAR — Conversation list */}
      <div className="w-64 lg:w-80 border-r border-stone-200 dark:border-gray-700 flex flex-col bg-stone-50 dark:bg-gray-900/50">
        <div className="p-3 border-b border-stone-200 dark:border-gray-700">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-moss-500 text-white rounded-lg hover:bg-moss-600 text-sm font-medium transition-colors duration-150"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-stone-400 dark:text-gray-500">No conversations yet</div>
          ) : (
            conversations.map(convo => (
              <div
                key={convo.id}
                onClick={() => selectConversation(convo)}
                className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer border-b border-stone-100 dark:border-gray-800 border-l-2 transition-colors duration-150 ${
                  activeConvo?.id === convo.id
                    ? 'bg-moss-50 dark:bg-moss-950/20 border-l-moss-500'
                    : 'hover:bg-stone-100 dark:hover:bg-gray-800 border-l-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-stone-700 dark:text-gray-300 truncate">
                    {convo.title || 'New Chat'}
                  </div>
                  <div className="text-xs text-stone-400 dark:text-gray-500 flex items-center gap-2 mt-0.5">
                    <Badge variant={MODEL_COLORS[convo.model] || 'gray'}>
                      {MODEL_LABELS[convo.model] || convo.model}
                    </Badge>
                    <span>{convo.message_count} msgs</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeConversation(convo.id); }}
                  aria-label="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all duration-150"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN — Chat area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900/30">
          <div className="flex items-center gap-3 min-w-0">
            <MessageSquare size={18} className="text-moss-500 flex-shrink-0" />
            <span className="text-sm font-medium text-stone-700 dark:text-gray-300 truncate">
              {activeConvo?.title || 'New Chat'}
            </span>
            {activeContextType && (
              <Badge variant="moss">{activeContextType.replace(/_/g, ' ')} #{activeContextId}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Model"
              className="text-xs border border-stone-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300"
            >
              <option value="deepseek-chat">V4 Pro</option>
              <option value="deepseek-chat-max">V4 Pro Max</option>
              <option value="deepseek-r1-local">R1 (Local)</option>
            </select>
            <button
              onClick={() => setShowSettings(s => !s)}
              aria-label="Sampling settings"
              className={`p-1.5 rounded-lg transition-colors duration-150 ${
                showSettings ? 'bg-moss-100 dark:bg-moss-900/30 text-moss-600 dark:text-moss-400' : 'text-stone-400 hover:text-stone-600 dark:hover:text-gray-300'
              }`}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="px-4 py-3 border-b border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900/20 space-y-3">
            <div className="flex items-center gap-4">
              <label htmlFor="temp-range" className="text-xs text-stone-500 dark:text-gray-400 w-24">Temperature</label>
              <input id="temp-range" type="range" min="0" max="2" step="0.1" value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))} className="flex-1 accent-moss-500" />
              <span className="text-xs text-stone-600 dark:text-gray-400 w-8 text-right tabular-nums">{temperature}</span>
            </div>
            <div className="flex items-center gap-4">
              <label htmlFor="topp-range" className="text-xs text-stone-500 dark:text-gray-400 w-24">Top P</label>
              <input id="topp-range" type="range" min="0" max="1" step="0.05" value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))} className="flex-1 accent-moss-500" />
              <span className="text-xs text-stone-600 dark:text-gray-400 w-8 text-right tabular-nums">{topP}</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {visibleMessages.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="AI Assistant"
              message="Ask anything. Research, brainstorm, debug, or explore ideas — your AI partner in Polymath OS."
            />
          ) : (
            visibleMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-moss-500 text-white'
                    : 'bg-stone-100 dark:bg-gray-700 text-stone-800 dark:text-gray-200'
                }`}>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                    {msg.streaming && <span className="animate-pulse">▊</span>}
                  </div>
                  {!msg.streaming && msg.role === 'assistant' && msg.content && (
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-stone-200/60 dark:border-gray-600/60">
                      <button onClick={() => copyMessage(msg.content)}
                        className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-gray-300 flex items-center gap-1">
                        <Copy size={12} /> Copy
                      </button>
                      <button onClick={() => saveToResearch(msg.content)}
                        className="text-xs text-stone-400 hover:text-moss-600 dark:hover:text-moss-400 flex items-center gap-1">
                        <Bookmark size={12} /> Save to Research
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-stone-200 dark:border-gray-700">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask DeepSeek anything…"
              rows={2}
              disabled={streaming}
              className="flex-1 px-4 py-2.5 border border-stone-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-stone-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-moss-500 focus:border-transparent disabled:opacity-50 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              aria-label="Send message"
              className="p-2.5 bg-moss-500 text-white rounded-xl hover:bg-moss-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-stone-400 dark:text-gray-500">
            <span>Enter to send · Shift+Enter for newline · ⌘J to focus</span>
            <span>{MODEL_LABELS[model]} · temp {temperature}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
