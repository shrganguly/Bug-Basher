import CryptoJS from 'crypto-js';
import { logger } from './logger';

/**
 * Encryption utility for sensitive data like PAT tokens
 * Uses AES-256 encryption with a secret key
 */
export class EncryptionService {
  private secretKey: string;

  constructor() {
    // Get encryption key from environment variable or generate a default one
    // IMPORTANT: In production, ALWAYS set ENCRYPTION_KEY environment variable
    this.secretKey = process.env.ENCRYPTION_KEY || this.getDefaultKey();

    if (!process.env.ENCRYPTION_KEY) {
      logger.warn('⚠️  ENCRYPTION_KEY not set! Using default key. Set ENCRYPTION_KEY env var for production.');
    }
  }

  /**
   * Encrypt a string value
   */
  public encrypt(plainText: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(plainText, this.secretKey).toString();
      return encrypted;
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   */
  public decrypt(encryptedText: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.secretKey);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);

      if (!plainText) {
        throw new Error('Decryption resulted in empty string');
      }

      return plainText;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data - key may have changed');
    }
  }

  /**
   * Check if a string appears to be encrypted (basic check)
   */
  public isEncrypted(text: string): boolean {
    // Encrypted AES strings from crypto-js typically contain only base64 characters
    // and are longer than typical plaintext tokens
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    return base64Pattern.test(text) && text.length > 50;
  }

  /**
   * Generate a default key (not for production!)
   */
  private getDefaultKey(): string {
    // Generate a consistent key based on app ID (not secure, but better than hardcoded)
    const appId = process.env.MICROSOFT_APP_ID || 'bug-basher-default';
    return `bug-basher-${appId}-encryption-key-DO-NOT-USE-IN-PRODUCTION`;
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
