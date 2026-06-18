// Phase 10: exercises the SHIPPED multer filter from research.js, not a copy.
// Storage is overridden to memory so the test avoids disk writes;
// the fileFilter under test is the real exported function.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

vi.mock('../lib/db.js', () => {
  const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { researchFileFilter } from '../routes/research.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: researchFileFilter,
});

const testApp = express();
testApp.post('/upload', upload.single('file'), (req, res) => {
  res.json({ success: true, filename: req.file?.originalname });
});
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
