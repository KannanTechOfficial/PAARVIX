/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadSheet, NOT_READABLE, parseSheetId, signJwt, validateServiceAccount } from './gsheet.client';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-aBcD';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const KEY_TEXT = JSON.stringify({ client_email: 'bot@example.iam.gserviceaccount.com', private_key: privateKey, token_uri: 'https://evil.example/token' });

const zip = () => new Response(Buffer.from('PK\x03\x04 pretend workbook'), { status: 200 });
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });

describe('parseSheetId', () => {
  it('extracts the ID from an edit link', () => {
    expect(parseSheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(ID);
    expect(parseSheetId(`https://docs.google.com/spreadsheets/d/${ID}`)).toBe(ID);
    expect(parseSheetId(`https://docs.google.com/spreadsheets/u/1/d/${ID}/edit`)).toBe(ID);
  });

  it.each([
    'http://169.254.169.254/x',
    `https://evil.example/spreadsheets/d/${ID}/edit`,
    `https://docs.google.com.evil.example/spreadsheets/d/${ID}/edit`,
    `http://docs.google.com/spreadsheets/d/${ID}/edit`,
    `https://docs.google.com:8443/spreadsheets/d/${ID}/edit`,
    `https://user@docs.google.com/spreadsheets/d/${ID}/edit`,
    'https://docs.google.com/spreadsheets/d/../etc/passwd',
    'https://docs.google.com/spreadsheets/d/abc%2F..%2Fdef12345/edit',
    'https://docs.google.com/spreadsheets/d/e/2PACX-publishedlink/pubhtml',
    'not a link',
    '',
  ])('rejects %s', (link) => {
    expect(() => parseSheetId(link)).toThrow();
  });
});

describe('validateServiceAccount', () => {
  it('keeps only client_email and private_key', () => {
    const out = JSON.parse(validateServiceAccount(KEY_TEXT));
    expect(Object.keys(out).sort()).toEqual(['client_email', 'private_key']);
  });

  it.each([
    ['not json', 'nope'],
    ['no email', JSON.stringify({ private_key: privateKey })],
    ['non-string email', JSON.stringify({ client_email: 5, private_key: privateKey })],
    ['non-string key', JSON.stringify({ client_email: 'a@b.c', private_key: {} })],
    ['garbage key', JSON.stringify({ client_email: 'a@b.c', private_key: 'not a pem' })],
    ['an array', '[]'],
    ['an EC key', JSON.stringify({ client_email: 'a@b.c', private_key: generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey })],
  ])('rejects %s', (_n, text) => {
    expect(() => validateServiceAccount(text)).toThrow();
  });

  it('rejects a non-string value', () => {
    expect(() => validateServiceAccount({ client_email: 'a@b.c' })).toThrow();
  });
});

describe('signJwt', () => {
  it('produces an RS256 signature the public key verifies, aimed at the fixed token URL', () => {
    const jwt = signJwt({ client_email: 'bot@example.iam.gserviceaccount.com', private_key: privateKey }, 1000);
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'bot@example.iam.gserviceaccount.com', aud: 'https://oauth2.googleapis.com/token', iat: 1000, exp: 4600 });
    expect(verify('RSA-SHA256', Buffer.from(`${h}.${c}`), createPublicKey(publicKey), Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('downloadSheet', () => {
  let dir: string;
  let dest: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gsheet-test-'));
    dest = join(dir, 'out.xlsx');
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const run = (fetchImpl: jest.Mock, sa?: string, maxBytes?: number) =>
    downloadSheet(ID, sa, dest, { fetch: fetchImpl as unknown as typeof fetch, maxBytes });

  it('downloads a public sheet and follows an allowed googleusercontent redirect', async () => {
    const f = jest.fn().mockResolvedValueOnce(redirect('https://doc-0k-sheets.googleusercontent.com/export/x')).mockResolvedValueOnce(zip());
    await run(f);
    expect(String(f.mock.calls[0][0])).toBe(`https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`);
    expect((await readFile(dest)).subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
  });

  it.each([
    'https://accounts.google.com/ServiceLogin',
    'https://169.254.169.254/latest',
    'http://docs.google.com/spreadsheets/d/x/export',
    'https://evilgoogleusercontent.com/x',
    'https://docs.google.com.evil.example/x',
  ])('refuses a redirect to %s without requesting it', async (to) => {
    const f = jest.fn().mockResolvedValueOnce(redirect(to));
    await expect(run(f)).rejects.toThrow(NOT_READABLE);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('treats a redirect without a Location as unreadable', async () => {
    const f = jest.fn().mockResolvedValueOnce(new Response(null, { status: 302 }));
    await expect(run(f)).rejects.toThrow(NOT_READABLE);
  });

  it('stops after 5 redirects', async () => {
    const f = jest.fn().mockImplementation(async () => redirect('https://docs.google.com/again'));
    await expect(run(f)).rejects.toThrow('too many');
    expect(f).toHaveBeenCalledTimes(6);
  });

  it('does not import an HTML sign-in page served with status 200', async () => {
    const f = jest.fn().mockResolvedValueOnce(new Response('<html>Sign in</html>', { status: 200 }));
    await expect(run(f)).rejects.toThrow(NOT_READABLE);
  });

  it.each([401, 403, 404])('maps %s to the share message', async (status) => {
    await expect(run(jest.fn().mockResolvedValueOnce(new Response('x', { status })))).rejects.toThrow(NOT_READABLE);
  });

  it('maps exportSizeLimitExceeded to the size message', async () => {
    const body = JSON.stringify({ error: { errors: [{ reason: 'exportSizeLimitExceeded' }] } });
    await expect(run(jest.fn().mockResolvedValueOnce(new Response(body, { status: 403 })))).rejects.toThrow('too large for Google');
  });

  it('aborts a download over the size limit', async () => {
    const big = new Response(Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(2000)]), { status: 200 });
    await expect(run(jest.fn().mockResolvedValueOnce(big), undefined, 1000)).rejects.toThrow('larger than 50 MB');
  });

  it('maps a network failure to a plain message without its details', async () => {
    const f = jest.fn().mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED 10.0.0.1'), { name: 'Error' }));
    await expect(run(f)).rejects.toThrow('Could not reach Google');
  });

  it('uses the fixed token URL and Drive host with a service account, ignoring token_uri', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok123' }), { status: 200 }))
      .mockResolvedValueOnce(zip());
    await run(f, validateServiceAccount(KEY_TEXT));
    expect(String(f.mock.calls[0][0])).toBe('https://oauth2.googleapis.com/token');
    expect(String(f.mock.calls[1][0])).toContain(`https://www.googleapis.com/drive/v3/files/${ID}/export?mimeType=`);
    expect(f.mock.calls[1][1].headers.authorization).toBe('Bearer tok123');
    expect(f.mock.calls[1][1].redirect).toBe('manual');
  });

  it('refuses any redirect from the token or Drive calls, and does not leak the bearer token onward', async () => {
    const f = jest.fn().mockResolvedValueOnce(redirect('https://oauth2.googleapis.com/elsewhere'));
    await expect(run(f, validateServiceAccount(KEY_TEXT))).rejects.toThrow('too many');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected key plainly', async () => {
    const f = jest.fn().mockResolvedValueOnce(new Response('{"error":"invalid_grant","error_description":"secret detail"}', { status: 400 }));
    await expect(run(f, validateServiceAccount(KEY_TEXT))).rejects.toThrow('Google rejected the service account key');
  });
});
