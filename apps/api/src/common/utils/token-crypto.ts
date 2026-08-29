import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptionSecret(): string {
  const secret =
    process.env.PAYMENT_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (!secret) {
    throw new Error('PAYMENT_TOKEN_ENCRYPTION_KEY o JWT_SECRET requerido para cifrar tokens');
  }
  return secret;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, deriveKey(encryptionSecret()), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Token cifrado inválido');
  }
  const decipher = createDecipheriv(
    ALGO,
    deriveKey(encryptionSecret()),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
