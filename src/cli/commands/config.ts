import { Command } from 'commander';
import { getConfig, updateConfig, saveConfig } from '../../config/index.js';
import { AppConfig } from '../../types/index.js';
import { homedir } from 'os';
import { join } from 'path';

/**
 * 显示配置信息
 */
function displayConfig(config: AppConfig): void {
  console.log('\n' + '='.repeat(50));
  console.log('当前配置信息');
  console.log('='.repeat(50));
  
  console.log('\nAPI 配置:');
  console.log(`  基础URL: ${config.api.baseUrl}`);
  console.log(`  超时时间: ${config.api.timeout}ms`);
  console.log(`  重试次数: ${config.api.retryAttempts}`);
  console.log(`  重试延迟: ${config.api.retryDelay}ms`);
  
  console.log('\n速率限制:');
  console.log(`  请求间隔: ${config.api.rateLimit.requestInterval}ms`);
  console.log(`  突发请求数: ${config.api.rateLimit.burstLimit}`);
  
  console.log('\n缓存配置:');
  console.log(`  启用状态: ${config.cache.enabled ? '启用' : '禁用'}`);
  console.log(`  过期时间: ${config.cache.ttl}秒`);
  console.log(`  最大条目: ${config.cache.maxEntries}`);
  console.log(`  最大大小: ${Math.round(config.cache.maxSize / 1024 / 1024)}MB`);
  console.log(`  缓存目录: ${config.cache.cacheDir}`);
  
  console.log('='.repeat(50) + '\n');
}

/**
 * 验证配置值
 */
function validateConfigValue(key: string, value: string): any {
  switch (key) {
    case 'api.timeout':
    case 'api.retryAttempts':
    case 'api.retryDelay':
    case 'api.rateLimit.requestInterval':
    case 'api.rateLimit.burstLimit':
    case 'cache.ttl':
    case 'cache.maxEntries':
    case 'cache.maxSize':
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 0) {
        throw new Error(`${key} 必须是非负整数`);
      }
      return numValue;
    
    case 'cache.enabled':
      if (value.toLowerCase() === 'true' || value === '1') {
        return true;
      } else if (value.toLowerCase() === 'false' || value === '0') {
        return false;
      } else {
        throw new Error(`${key} 必须是 true 或 false`);
      }
    
    case 'api.baseUrl':
    case 'cache.cacheDir':
      if (!value.trim()) {
        throw new Error(`${key} 不能为空`);
      }
      return value.trim();
    
    default:
      throw new Error(`未知的配置项: ${key}`);
  }
}

/**
 * 设置嵌套配置值
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * 获取嵌套配置值
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

export const configCommand = new Command('config')
  .description('配置管理命令')
  .addCommand(
    new Command('show')
      .description('显示当前配置')
      .option('-k, --key <key>', '显示特定配置项 (如: api.timeout, cache.enabled)')
      .action(async (options) => {
        try {
          const config = getConfig();
          
          if (options.key) {
            const value = getNestedValue(config, options.key);
            if (value !== undefined) {
              console.log(`${options.key}: ${JSON.stringify(value, null, 2)}`);
            } else {
              console.error(`配置项 '${options.key}' 不存在`);
              process.exit(1);
            }
          } else {
            displayConfig(config);
          }
        } catch (error: any) {
          console.error('获取配置失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('设置配置项')
      .argument('<key>', '配置项名称 (如: api.timeout, cache.enabled)')
      .argument('<value>', '配置项值')
      .action(async (key, value) => {
        try {
          // 验证配置值
          const validatedValue = validateConfigValue(key, value);
          
          // 获取当前配置
          const config = getConfig();
          
          // 设置新值
          setNestedValue(config, key, validatedValue);
          
          // 保存配置
          await saveConfig(config);
          
          console.log(`配置项 '${key}' 已设置为: ${JSON.stringify(validatedValue)}`);
        } catch (error: any) {
          console.error('设置配置失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('reset')
      .description('重置配置到默认值')
      .option('-k, --key <key>', '重置特定配置项')
      .option('-y, --yes', '跳过确认提示')
      .action(async (options) => {
        try {
          if (!options.yes) {
            const readline = await import('readline');
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            
            const question = options.key 
              ? `确定要重置配置项 '${options.key}' 到默认值吗? (y/N): `
              : '确定要重置所有配置到默认值吗? (y/N): ';
            
            const answer = await new Promise<string>((resolve) => {
              rl.question(question, resolve);
            });
            
            rl.close();
            
            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
              console.log('操作已取消');
              return;
            }
          }
          
          if (options.key) {
            // 重置特定配置项
            const { loadConfig } = await import('../../config/index.js');
            const defaultConfig = await loadConfig();
            const defaultValue = getNestedValue(defaultConfig, options.key);
            
            if (defaultValue === undefined) {
              console.error(`配置项 '${options.key}' 不存在`);
              process.exit(1);
            }
            
            const config = getConfig();
            setNestedValue(config, options.key, defaultValue);
            await saveConfig(config);
            
            console.log(`配置项 '${options.key}' 已重置为默认值: ${JSON.stringify(defaultValue)}`);
          } else {
            // 重置所有配置
            const { loadConfig } = await import('../../config/index.js');
            const defaultConfig = await loadConfig();
            await saveConfig(defaultConfig);
            
            console.log('所有配置已重置为默认值');
          }
        } catch (error: any) {
          console.error('重置配置失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('validate')
      .description('验证当前配置')
      .action(async () => {
        try {
          const config = getConfig();
          
          console.log('正在验证配置...');
          
          // 验证 API 配置
          const issues: string[] = [];
          
          if (!config.api.baseUrl) {
            issues.push('API baseUrl 不能为空');
          }
          
          if (config.api.timeout <= 0) {
            issues.push('API timeout 必须大于 0');
          }
          
          if (config.api.retryAttempts < 0) {
            issues.push('API retryAttempts 不能为负数');
          }
          
          if (config.api.retryDelay < 0) {
            issues.push('API retryDelay 不能为负数');
          }
          
          if (config.api.rateLimit.requestInterval <= 0) {
            issues.push('rateLimit requestInterval 必须大于 0');
          }
          
          if (config.api.rateLimit.burstLimit <= 0) {
            issues.push('rateLimit burstLimit 必须大于 0');
          }
          
          // 验证缓存配置
          if (config.cache.ttl <= 0) {
            issues.push('cache ttl 必须大于 0');
          }
          
          if (config.cache.maxEntries <= 0) {
            issues.push('cache maxEntries 必须大于 0');
          }
          
          if (config.cache.maxSize <= 0) {
            issues.push('cache maxSize 必须大于 0');
          }
          
          if (!config.cache.cacheDir) {
            issues.push('cache cacheDir 不能为空');
          }
          
          if (issues.length === 0) {
            console.log('✅ 配置验证通过');
          } else {
            console.log('❌ 配置验证失败:');
            issues.forEach(issue => {
              console.log(`  - ${issue}`);
            });
            process.exit(1);
          }
        } catch (error: any) {
          console.error('验证配置失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('path')
      .description('显示配置文件路径')
      .action(() => {
        try {
          const configPath = join(homedir(), '.cf-tool', 'config.json');
          console.log(`配置文件路径: ${configPath}`);
        } catch (error: any) {
          console.error('获取配置路径失败:', error.message);
          process.exit(1);
        }
      })
  );