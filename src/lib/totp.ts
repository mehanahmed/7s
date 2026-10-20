import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32 secret string (20 bytes = 32 base32 characters)
 */
export function generateBase32Secret(length = 32): string {
  const randomBytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Decode a Base32 string to a Buffer
 */
export function base32ToBuffer(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generate 6-digit TOTP code for secret at given time window offset
 */
export function generateTOTP(base32Secret: string, timeStepWindowOffset = 0): string {
  const key = base32ToBuffer(base32Secret);
  const timeStep = Math.floor(Date.now() / 1000 / 30) + timeStepWindowOffset;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP token against secret with ±1 time window tolerance (90s window)
 */
export function verifyTOTP(base32Secret: string, token: string): boolean {
  if (!token || token.trim().length !== 6) return false;
  const cleanToken = token.trim();
  for (let offset = -1; offset <= 1; offset++) {
    if (generateTOTP(base32Secret, offset) === cleanToken) {
      return true;
    }
  }
  return false;
}

/**
 * Generate 8 single-use backup codes (format: XXXX-XXXX)
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${buf.slice(0, 4)}-${buf.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Generate standard otpauth URL for Authenticator Apps
 */
export function generateOtpAuthUrl(secret: string, email: string, issuer = 'Seven Solution'): string {
  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}`;
}
