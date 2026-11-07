import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../../config.js';
import { encrypt, decrypt, signFileToken, verifyFileToken } from '../../lib/crypto.js';
import { forbidden, notFound } from '../../lib/errors.js';

// Encrypted object storage (local-disk implementation). Swap for S3/GCS with
// server-side encryption + presigned URLs in production; the interface is the same.
const dir = path.join(config.storageDir, 'objects');

export async function putObject(buffer) {
  await fs.mkdir(dir, { recursive: true });
  const key = crypto.randomUUID();
  await fs.writeFile(path.join(dir, `${key}.bin`), encrypt(buffer));
  return key;
}

export async function getObject(key) {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw notFound('File');
  try {
    return decrypt(await fs.readFile(path.join(dir, `${key}.bin`)));
  } catch {
    throw notFound('File');
  }
}

export function signedUrl(key, mime, ttlSec = 300) {
  const { exp, sig } = signFileToken(key, ttlSec);
  return `${config.publicApiUrl}/v1/files/${key}?exp=${exp}&sig=${sig}&type=${encodeURIComponent(mime)}`;
}

export const filesRouter = Router();
filesRouter.get('/:key', async (req, res) => {
  if (!verifyFileToken(req.params.key, req.query.exp, req.query.sig)) throw forbidden('Link expired or invalid');
  const buf = await getObject(req.params.key);
  const type = String(req.query.type || 'application/octet-stream');
  res.setHeader('Content-Type', /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type : 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', 'inline');
  res.send(buf);
});
