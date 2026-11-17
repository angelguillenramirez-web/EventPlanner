// Browser-side crypto helpers (WebCrypto). Passwords are salted PBKDF2 hashes; 2FA is a standard RFC 6238 TOTP
// (works with Google Authenticator, Authy, 1Password, Microsoft Authenticator...).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const enc = new TextEncoder();

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
export const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

export function b32encode(bytes: Uint8Array): string {
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}
export function b32decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = "";
  for (const c of clean) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(out);
}
export const newTotpSecret = () => b32encode(randomBytes(20));

const ITER = 210_000;
export async function hashPassword(pw: string, saltHex?: string): Promise<{ salt: string; hash: string }> {
  const salt = saltHex ?? toHex(randomBytes(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt) as BufferSource, iterations: ITER }, key, 256);
  return { salt, hash: toHex(new Uint8Array(bits)) };
}
/** Constant-time string compare. */
export function safeEq(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export async function checkPassword(pw: string, salt: string, hash: string): Promise<boolean> {
  return safeEq((await hashPassword(pw, salt)).hash, hash);
}

export const totpStep = (t = Date.now()) => Math.floor(t / 30000);
export async function totpAt(secret: string, step: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", b32decode(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, step);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
/** Returns the matched time step (±1 step of clock drift) or null. `lastStep` blocks re-using a code. */
export async function verifyTotp(secret: string, code: string, lastStep = 0): Promise<number | null> {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = totpStep();
  for (const step of [now, now - 1, now + 1]) {
    if (step > lastStep && safeEq(await totpAt(secret, step), c)) return step;
  }
  return null;
}
export const otpauthUri = (email: string, secret: string) =>
  `otpauth://totp/${encodeURIComponent("643 Staff")}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent("643 Staff")}&algorithm=SHA1&digits=6&period=30`;

export function passwordIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 12) out.push("at least 12 characters");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) out.push("upper and lower case letters");
  if (!/\d/.test(pw)) out.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) out.push("a symbol");
  return out;
}
export const randomPassword = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = randomBytes(14);
  return [...r].map((x) => a[x % a.length]).join("") + "!7";
};
