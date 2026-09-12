import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(input: string): Buffer {
  input = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.ceil((input.length * 5) / 8));

  for (let i = 0; i < input.length; i++) {
    const val = BASE32_ALPHABET.indexOf(input[i]!);
    if (val === -1) throw new Error("Invalid base32 character in input");
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output.subarray(0, index);
}

/**
 * Generates a TOTP secret in Base32.
 */
export function generateTotpSecret(length: number = 20): string {
  const secret = crypto.randomBytes(length);
  return encodeBase32(secret);
}

/**
 * Generates an OTP Auth URI for QR Codes.
 */
export function generateOtpAuthUri(accountName: string, issuer: string, secretBase32: string): string {
  const account = encodeURIComponent(accountName);
  const issuerEnc = encodeURIComponent(issuer);
  return `otpauth://totp/${issuerEnc}:${account}?secret=${secretBase32}&issuer=${issuerEnc}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Verifies a TOTP code against a secret.
 * Allows a drift window of +/- 1 step (default 30s step).
 */
export function verifyTotpCode(code: string, secretBase32: string, window: number = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  
  try {
    const secretBytes = decodeBase32(secretBase32);
    const counter = Math.floor(Date.now() / 30000);

    for (let i = -window; i <= window; i++) {
      if (generateTotpCode(secretBytes, counter + i) === code) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}

function generateTotpCode(secretBytes: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buffer[i] = counter & 0xff;
    counter = counter >> 8;
  }

  const hmac = crypto.createHmac("sha1", secretBytes);
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1]! & 0xf;
  const binary =
    ((hash[offset]! & 0x7f) << 24) |
    ((hash[offset + 1]! & 0xff) << 16) |
    ((hash[offset + 2]! & 0xff) << 8) |
    (hash[offset + 3]! & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, "0");
  return otp;
}
