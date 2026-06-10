// Phase 4: multer upload file-type rejection test
// Uses supertest against a minimal Express app that mounts only the upload middleware,
// without requiring a real DB or real filesystem writes.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { AppError } from '../lib/AppError.js';

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Build an isolated test app with only the multer filter ────────────────
// Re-implement the same ALLOWED_EXT / ALLOWED_MIME / multer config from research.js
// so the test validates the logic without spinning up the full server.
import multer from 'multer';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.txt', '.md', '.cpp', '.py', '.zip']);
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'text/markdown',
  'text/x-c++src', 'text/x-python', 'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(), // avoid touching disk in tests
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      return cb(new AppError('Unsupported file type.', 400, 'VALIDATION_ERROR', 'file'));
    }
    cb(null, true);
  },
});

const testApp = express();
testApp.post('/upload', upload.single('file'), (req, res) => {
  res.json({ success: true, filename: req.file?.originalname });
});
// Phase 4: minimal error handler for the test app
testApp.use((err, _req, res, _next) => {
  res.status(err.statusCode ?? 500).json({ success: false, error: { code: err.code, message: err.message } });
});

describe('Upload file-type filter', () => {
  it('accepts an allowed .txt file with text/plain MIME', async () => {
    const res = await request(testApp)
      .post('/upload')
      .attach('file', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts a .jpg file with image/jpeg MIME', async () => {
    const res = await request(testApp)
      .post('/upload')
      .attach('file', Buffer.from('fake-image-data'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts a .py file with application/octet-stream (browser fallback)', async () => {
    const res = await request(testApp)
      .post('/upload')
      .attach('file', Buffer.from('print("hi")'), { filename: 'script.py', contentType: 'application/octet-stream' });

    expect(res.status).toBe(200);
  });

  it('rejects a .exe file (disallowed extension)', async () => {
    const res = await request(testApp)
      .post('/upload')
      .attach('file', Buffer.from('MZ'), { filename: 'malware.exe', contentType: 'application/octet-stream' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Unsupported file type.');
  });

  it('rejects a file with disallowed MIME even if extension is .txt', async () => {
    const res = await request(testApp)
      .post('/upload')
      .attach('file', Buffer.from('x'), { filename: 'sneaky.txt', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a .html file', async () => {
    const res = await request(testApp)
      .post('/upload')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'xss.html', contentType: 'text/html' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
