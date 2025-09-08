import { AppConfig } from '../types/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 默认配置
const defaultConfig: AppConfig = {
  api: {
    baseUrl: 'https://codeforces.com/api',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    rateLimit: {
      requests: 5,
      window: 1000,
      burstLimit: 5
    }
  },
  cache: {
    enabled: true,
    ttl: 300, // 5分钟
    maxEntries: 1000,
    maxSize: 50 * 1024 * 1024, // 50MB
    cacheDir: join(homedir(), '.cf-tool', 'cache')
  },
  handle: '' // 初始为空字符串
};

// 配置文件路径
const configDir = join(homedir(), '.codeforces-api-tool');
const configPath = join(configDir, 'config.json');

/**
 * 加载配置
 */
export function loadConfig(): AppConfig {
  try {
    if (existsSync(configPath)) {
      const configData = readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configData);
      return { ...defaultConfig, ...userConfig };
    }
  } catch (error) {
    console.warn('Failed to load config, using defaults:', error);
  }
  
  return defaultConfig;
}

/**
 * 保存配置
 */
export function saveConfig(config: AppConfig): void {
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

let configCache: AppConfig | null = null;

/**
 * 获取当前配置
 */
export function getConfig(): AppConfig {
  if (!configCache) {
    configCache = loadConfigSync();
  }
  return configCache;
}

/**
 * 同步加载配置
 */
function loadConfigSync(): AppConfig {
  try {
    if (existsSync(configPath)) {
      const configData = readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configData);
      return { ...defaultConfig, ...userConfig };
    }
  } catch (error) {
    console.warn('加载配置文件失败，使用默认配置:', error);
  }
  return { ...defaultConfig };
}

/**
 * 更新配置
 */
export function updateConfig(updates: Partial<AppConfig>): void {
  const newConfig = { ...getConfig(), ...updates };
  saveConfig(newConfig);
  configCache = newConfig;
}