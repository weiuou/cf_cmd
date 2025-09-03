import { promises as fs, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { getConfig } from '../config/index.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private cacheDir: string;

  constructor() {
    const config = getConfig();
    this.cacheDir = config.cache.cacheDir;
    this.ensureCacheDir();
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成缓存键的哈希
   */
  private hashKey(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFilePath(key: string): string {
    const hashedKey = this.hashKey(key);
    return join(this.cacheDir, `${hashedKey}.json`);
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const config = getConfig();
    if (!config.cache.enabled) {
      return;
    }

    try {
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || config.cache.ttl * 1000 // 转换为毫秒
      };

      const filePath = this.getCacheFilePath(key);
      writeFileSync(filePath, JSON.stringify(cacheEntry));
      
      // 清理过期缓存
      this.cleanup();
    } catch (error) {
      console.warn('Failed to set cache:', error);
    }
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const config = getConfig();
    if (!config.cache.enabled) {
      return null;
    }

    try {
      const filePath = this.getCacheFilePath(key);
      
      if (!existsSync(filePath)) {
        return null;
      }

      const cacheData = readFileSync(filePath, 'utf-8');
      const cacheEntry: CacheEntry<T> = JSON.parse(cacheData);

      // 检查是否过期
      const now = Date.now();
      if (now - cacheEntry.timestamp > cacheEntry.ttl) {
        this.delete(key);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.warn('Failed to get cache:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    try {
      const filePath = this.getCacheFilePath(key);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Failed to delete cache:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    try {
      if (!existsSync(this.cacheDir)) {
        return;
      }

      const files = readdirSync(this.cacheDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = join(this.cacheDir, file);
        
        try {
          const cacheData = readFileSync(filePath, 'utf-8');
          const cacheEntry: CacheEntry<any> = JSON.parse(cacheData);

          // 检查是否过期
          if (now - cacheEntry.timestamp > cacheEntry.ttl) {
            unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
          // 如果文件损坏，删除它
          unlinkSync(filePath);
          deletedCount++;
        }
      }

      // 如果缓存文件数量超过限制，删除最旧的文件
      const config = getConfig();
      const remainingFiles = readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
      if (remainingFiles.length > config.cache.maxEntries) {
        const fileStats = remainingFiles.map(file => ({
          file,
          mtime: statSync(join(this.cacheDir, file)).mtime
        }));

        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        const filesToDelete = fileStats.slice(0, remainingFiles.length - config.cache.maxEntries);
        for (const { file } of filesToDelete) {
          unlinkSync(join(this.cacheDir, file));
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} cache files`);
      }
    } catch (error) {
      console.warn('Failed to cleanup cache:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    try {
      if (!existsSync(this.cacheDir)) {
        return;
      }

      const files = readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          unlinkSync(join(this.cacheDir, file));
        }
      }
      
      console.log('Cache cleared');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { totalFiles: number; totalSize: number } {
    try {
      if (!existsSync(this.cacheDir)) {
        return { totalFiles: 0, totalSize: 0 };
      }

      const files = readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
      let totalSize = 0;

      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        totalSize += statSync(filePath).size;
      }

      return {
        totalFiles: files.length,
        totalSize
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }
}

// 导出单例实例
export const cacheManager = new CacheManager();