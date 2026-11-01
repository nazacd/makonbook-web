// Copied from makonbook-mobile/src/lib/attendance/code.ts (docs/handoff.md section 5):
// must match the API's internal/attendance/token.go. Keep in step with the phone.
// The only differences are `!` assertions for this repo's noUncheckedIndexedAccess.

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

// Attendance QR codes — the same function as the API's
// internal/attendance/token.go (keep the two in step):
//
//   window = floor(unix_seconds / 10)
//   sig    = first 16 chars of base64url(HMAC-SHA256(secret, "<session_id>:<window>"))
//
// The teacher's phone computes codes itself from the session secret, so they
// keep changing even if its connection drops. The server accepts the current
// window and its neighbours.

export const WINDOW_SECONDS = 10;
const SIG_LENGTH = 16;

export function windowAt(ms: number): number {
  return Math.floor(ms / 1000 / WINDOW_SECONDS);
}

export function sign(secret: Uint8Array, sessionId: string, window: number): string {
  const mac = hmac(sha256, secret, utf8ToBytes(`${sessionId}:${window}`));
  return toBase64Url(mac).slice(0, SIG_LENGTH);
}

// What the QR encodes: a link the student's app opens. Scanned with the
// phone's own camera it opens MakonBook too.
const LINK_PREFIX = 'makonbookmobile://att/';

export function attendanceLink(sessionId: string, window: number, sig: string): string {
  return `${LINK_PREFIX}${sessionId}/${window}/${sig}`;
}

export type ScannedCode = { sessionId: string; window: number; sig: string };

// Reads a scanned QR. Anything that isn't a MakonBook attendance code
// returns null.
export function parseAttendanceLink(text: string): ScannedCode | null {
  const m = /^makonbookmobile:\/\/att\/([0-9a-f-]{36})\/(\d{1,12})\/([A-Za-z0-9_-]{16})$/.exec(text.trim());
  if (!m) return null;
  return { sessionId: m[1]!, window: Number(m[2]), sig: m[3]! };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += ALPHABET[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

export function fromBase64Url(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error('invalid base64url');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}
