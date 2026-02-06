import CryptoJS from 'crypto-js';
import { config } from '../config';

/**
 * Encrypts PII fields at rest using AES-256.
 * Used for regulated personal data fields (email, phone, address).
 */
export function encryptPII(plaintext: string): string {
  if (!config.encryption.key) {
    throw new Error('Encryption key not configured');
  }
  const key = CryptoJS.enc.Hex.parse(config.encryption.key);
  const iv = CryptoJS.enc.Hex.parse(config.encryption.iv);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });
  return encrypted.toString();
}

export function decryptPII(ciphertext: string): string {
  if (!config.encryption.key) {
    throw new Error('Encryption key not configured');
  }
  const key = CryptoJS.enc.Hex.parse(config.encryption.key);
  const iv = CryptoJS.enc.Hex.parse(config.encryption.iv);
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, { iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Hash a value for indexing encrypted fields (allows lookup without decryption).
 */
export function hashForIndex(value: string): string {
  return CryptoJS.SHA256(value + config.encryption.key).toString();
}
