import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/mysql';

// Master Public Key for Seven Solution Licenses (Ed25519)
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAwRID7HC5MZ1Oo1j8VmYKQt3euYbA+FD2litJOYF+0bU=
-----END PUBLIC KEY-----`;

export interface LicensePayload {
  v: number;
  domain: string;
  client: string;
  type: string;
  iat: number;
  exp: number | null;
}

export interface LicenseVerificationResult {
  valid: boolean;
  error?: string;
  payload?: LicensePayload;
  rawKey?: string;
  signature?: string;
}

// In-memory cache to avoid database hit on every request
interface LicenseCache {
  key: string | null;
  checkedAt: number;
  result: LicenseVerificationResult;
}

let memoryCache: LicenseCache | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Normalizes host/domain name (strips protocol, port, path, and www prefix if appropriate)
 */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return 'localhost';
  let clean = host.toLowerCase().trim();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.replace(/\/.*$/, '');
  clean = clean.replace(/:\d+$/, '');
  return clean;
}

/**
 * Checks if a host is a local developer environment
 */
export function isLocalDevHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.endsWith('.local')
  );
}

/**
 * Cryptographically verifies a license key string against a target host
 */
export function verifyLicenseKey(licenseKey: string, targetHost: string): LicenseVerificationResult {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, error: 'No license key provided.' };
  }

  const trimmed = licenseKey.trim();
  if (!trimmed.startsWith('7SLIC-')) {
    return { valid: false, error: 'Invalid license format. Must start with 7SLIC-' };
  }

  const parts = trimmed.substring(6).split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed license structure.' };
  }

  const [payloadB64, sigB64] = parts;

  let payload: LicensePayload;
  let canonicalJson: string;
  try {
    const rawJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(rawJson);
    canonicalJson = JSON.stringify(payload);
  } catch {
    return { valid: false, error: 'Corrupt license payload.' };
  }

  // Cryptographic Signature Verification (Ed25519)
  try {
    const signature = Buffer.from(sigB64, 'base64url');
    const isVerified = crypto.verify(
      null,
      Buffer.from(canonicalJson, 'utf8'),
      PUBLIC_KEY_PEM,
      signature
    );

    if (!isVerified) {
      return { valid: false, error: 'Digital signature invalid or tampered.' };
    }
  } catch (err: any) {
    return { valid: false, error: `Cryptographic verification failed: ${err?.message || 'unknown error'}` };
  }

  // Expiration check
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, error: 'License has expired.', payload };
  }

  // Domain binding check
  const host = normalizeHost(targetHost);
  const licensedDomain = normalizeHost(payload.domain);

  // Check exact match, wildcard (*.domain.com), or localhost in development
  const isExact = host === licensedDomain;
  const isWildcard = licensedDomain.startsWith('*.') && host.endsWith(licensedDomain.slice(2));

  if (!isExact && !isWildcard) {
    return {
      valid: false,
      error: `License bound to '${payload.domain}', does not match active domain '${host}'.`,
      payload
    };
  }

  return {
    valid: true,
    payload,
    rawKey: trimmed,
    signature: sigB64
  };
}

/**
 * Reads stored license key from database (global_settings) or fallback file (.license)
 */
export async function getStoredLicenseKey(): Promise<string | null> {
  // 1. Check database global_settings
  try {
    const rows = await query<any[]>('SELECT settings_json FROM global_settings WHERE id = ?', ['system_license']);
    if (rows && rows.length > 0) {
      const raw = rows[0].settings_json;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed?.key) return parsed.key;
    }
  } catch (err) {
    // Database may be initializing or offline
  }

  // 2. Check fallback file .license in project root
  try {
    const filePath = path.resolve(process.cwd(), '.license');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content) return content;
    }
  } catch {}

  // 3. Check environment variable override
  if (process.env.LICENSE_KEY) {
    return process.env.LICENSE_KEY.trim();
  }

  return null;
}

/**
 * Saves a license key to database and local backup file
 */
export async function saveLicenseKey(key: string, payload: LicensePayload): Promise<void> {
  const trimmed = key.trim();

  // Save to database
  try {
    const record = {
      key: trimmed,
      payload,
      activated_at: new Date().toISOString()
    };
    await query(`
      INSERT INTO global_settings (id, settings_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)
    `, ['system_license', JSON.stringify(record)]);
  } catch (err) {
    console.error('Failed to save license to database:', err);
  }

  // Save to local backup file .license
  try {
    const filePath = path.resolve(process.cwd(), '.license');
    fs.writeFileSync(filePath, trimmed, 'utf8');
  } catch (err) {
    console.error('Failed to write .license backup file:', err);
  }

  // Pre-seed active proof cache immediately
  const host = normalizeHost(payload.domain);
  const ver = verifyLicenseKey(trimmed, host);
  if (ver.valid && ver.signature) {
    activeProofCache = crypto.createHmac('sha256', ver.signature).update(`${host}:7s-kernel-lock`).digest('hex');
  }

  // Invalidate memory cache
  memoryCache = null;
}

/**
 * Checks system license status for the given host with in-memory caching
 */
export async function getSystemLicenseStatus(host: string): Promise<LicenseVerificationResult> {
  const normalized = normalizeHost(host);
  const now = Date.now();

  // Check cache
  if (memoryCache && (now - memoryCache.checkedAt) < CACHE_TTL_MS) {
    const cached = memoryCache.result;
    if (cached.valid && cached.payload) {
      const licDomain = normalizeHost(cached.payload.domain);
      if (normalized === licDomain || (licDomain.startsWith('*.') && normalized.endsWith(licDomain.slice(2)))) {
        return cached;
      }
    }
  }

  // In development, if running on localhost / LAN and no license is set, allow dev mode
  if (process.env.NODE_ENV !== 'production' && isLocalDevHost(normalized)) {
    return {
      valid: true,
      payload: {
        v: 1,
        domain: normalized,
        client: 'Local Development Environment',
        type: 'dev-bypass',
        iat: Math.floor(now / 1000),
        exp: null
      },
      signature: 'dev-signature-proof'
    };
  }

  const storedKey = await getStoredLicenseKey();
  if (!storedKey) {
    const res: LicenseVerificationResult = { valid: false, error: 'System is not activated for this domain.' };
    memoryCache = { key: null, checkedAt: now, result: res };
    return res;
  }

  const res = verifyLicenseKey(storedKey, normalized);
  memoryCache = { key: storedKey, checkedAt: now, result: res };
  return res;
}

let activeProofCache: string = '';

export function setActiveProofCache(proof: string) {
  activeProofCache = proof;
}

/**
 * Synchronous license proof retrieval for kernel cryptography routines.
 */
export function getSyncLicenseProof(targetHost?: string): string {
  if (activeProofCache) return activeProofCache;

  // Try reading synchronously from .license file
  try {
    const filePath = path.resolve(process.cwd(), '.license');
    if (fs.existsSync(filePath)) {
      const key = fs.readFileSync(filePath, 'utf8').trim();
      const host = normalizeHost(targetHost || process.env.NEXT_PUBLIC_APP_URL || 'localhost');
      const res = verifyLicenseKey(key, host);
      if (res.valid && res.signature) {
        activeProofCache = crypto.createHmac('sha256', res.signature).update(`${host}:7s-kernel-lock`).digest('hex');
        return activeProofCache;
      }
    }
  } catch {}

  if (process.env.NODE_ENV !== 'production') {
    return 'dev-local-kernel-proof';
  }

  return 'DENIED_UNLICENSED_PROOF';
}

/**
 * Cryptographic Entanglement Proof
 * Mathematical proof derived from the valid signature and current domain.
 * This is fed into session token derivation and guard checks.
 * If someone modifies or removes the license check, this proof becomes invalid,
 * breaking sessions, passwords, and server action processing across the entire application.
 */
export async function getLicenseProof(host?: string): Promise<string> {
  const targetHost = normalizeHost(host || process.env.NEXT_PUBLIC_APP_URL || 'localhost');
  const status = await getSystemLicenseStatus(targetHost);

  if (!status.valid || !status.signature) {
    return 'INVALID_LICENSE_PROOF_DENIED';
  }

  // Derive mathematical hash using HMAC
  const proof = crypto
    .createHmac('sha256', status.signature)
    .update(`${targetHost}:7s-kernel-lock`)
    .digest('hex');

  activeProofCache = proof;
  return proof;
}
