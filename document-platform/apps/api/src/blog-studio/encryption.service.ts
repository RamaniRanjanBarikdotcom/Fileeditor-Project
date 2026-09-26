import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  // Normally this would be loaded from an environment variable (e.g., process.env.ENCRYPTION_KEY)
  // For safety, we define a fallback or require the env var.
  private readonly key: Buffer;

  constructor() {
    const envKey = process.env.BLOG_STUDIO_ENCRYPTION_KEY;
    if (envKey) {
      this.key = Buffer.from(envKey, 'base64');
      if (this.key.length !== 32) {
        throw new Error('BLOG_STUDIO_ENCRYPTION_KEY must be a 32-byte base64 encoded string.');
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('BLOG_STUDIO_ENCRYPTION_KEY is required in production.');
    } else {
      // Deterministic development fallback. It is intentionally forbidden in production.
      this.key = Buffer.from('blog-studio-dev-key-change-me-01');
    }
  }

  encrypt(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    
    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const [ivStr, authTagStr, encryptedStr] = parts;
    const iv = Buffer.from(ivStr!, 'base64');
    const authTag = Buffer.from(authTagStr!, 'base64');
    
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedStr!, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
