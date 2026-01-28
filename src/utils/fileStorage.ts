import * as fs from 'fs';
import * as path from 'path';
import { Storage, StoreItems } from 'botbuilder';
import { logger } from './logger';

/**
 * Simple file-based storage for bot state
 * Stores state in JSON files on disk
 *
 * Note: On Render free tier, files may be lost on restart unless using persistent disk
 * For production, consider using Azure Blob Storage or a database
 */
export class FileStorage implements Storage {
  private storageDir: string;

  constructor(storageDir?: string) {
    // Default to ./storage directory, or use environment variable
    this.storageDir = storageDir || process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');

    // Create storage directory if it doesn't exist
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      logger.info('Created storage directory', { path: this.storageDir });
    }

    logger.info('FileStorage initialized', { storageDir: this.storageDir });
  }

  async read(keys: string[]): Promise<StoreItems> {
    const items: StoreItems = {};

    for (const key of keys) {
      try {
        const filePath = this.getFilePath(key);

        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath, 'utf-8');
          items[key] = JSON.parse(data);
        }
      } catch (error) {
        logger.error('Error reading from file storage', { key, error });
      }
    }

    return items;
  }

  async write(changes: StoreItems): Promise<void> {
    for (const [key, value] of Object.entries(changes)) {
      try {
        const filePath = this.getFilePath(key);
        const data = JSON.stringify(value, null, 2);
        fs.writeFileSync(filePath, data, 'utf-8');
      } catch (error) {
        logger.error('Error writing to file storage', { key, error });
        throw error;
      }
    }
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        const filePath = this.getFilePath(key);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        logger.error('Error deleting from file storage', { key, error });
      }
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key to be filesystem-safe
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.storageDir, `${safeKey}.json`);
  }
}
