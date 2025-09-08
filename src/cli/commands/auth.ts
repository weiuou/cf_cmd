import { Command } from 'commander';
import { codeforcesAPI } from '../../api/codeforces';
import { httpClient } from '../../utils/http';
import { LoginCredentials } from '../../types/index.js';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { saveConfig, loadConfig } from '../../config';

// 创建一个用于安全读取密码的函数
function readPassword(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const listener = (char: Buffer) => {
      const charStr = char.toString();
      // 处理回车键
      if (charStr === '\r' || charStr === '\n') {
        process.stdout.write('\n');
        stdin.removeListener('data', listener);
        rl.close();
        resolve(password);
        return;
      }
      // 处理退格键
      if (charStr === '\b' || charStr === '\x7f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      // 处理Ctrl+C
      if (charStr === '\u0003') {
        process.stdout.write('\n');
        process.exit(0);
      }
      // 添加字符到密码
      password += charStr;
      process.stdout.write('*');
    };

    let password = '';
    process.stdout.write(query);
    stdin.setRawMode(true);
    stdin.on('data', listener);
  });
}

// 保存登录状态的函数
async function saveLoginStatus(handle: string): Promise<void> {
  // 使用配置系统保存登录状态
  const config = loadConfig();
  config.handle = handle;
  await saveConfig(config);
  
  const configDir = path.join(os.homedir(), '.cf-tool');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const statusFile = path.join(configDir, 'login-status.json');
  fs.writeFileSync(statusFile, JSON.stringify({ handle, timestamp: Date.now() }));
  console.log(`登录状态已保存，当前用户: ${handle}`);
}

// 检查登录状态的函数
async function checkLoginStatus(): Promise<{ handle?: string, loggedIn: boolean }> {
  // 首先尝试从API检查登录状态
  const isLoggedIn = await codeforcesAPI.isLoggedIn();
  if (isLoggedIn) {
    const config = loadConfig();
    return { handle: config.handle, loggedIn: true };
  }
  
  // 如果API检查失败，尝试从文件读取
  const configDir = path.join(os.homedir(), '.cf-tool');
  const statusFile = path.join(configDir, 'login-status.json');
  
  if (!fs.existsSync(statusFile)) {
    return { loggedIn: false };
  }
  
  try {
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
    // 检查登录是否过期（7天）
    const now = Date.now();
    const expired = now - status.timestamp > 7 * 24 * 60 * 60 * 1000;
    
    if (expired) {
      return { loggedIn: false };
    }
    
    return { handle: status.handle, loggedIn: true };
  } catch (error) {
    return { loggedIn: false };
  }
}

export const authCommand = new Command('auth')
  .description('登录和认证相关命令')
  .addCommand(
    new Command('manual-login')
      .description('手动输入登录信息（在浏览器中登录后）')
      .action(async () => {
        try {
          console.log('请先在浏览器中登录Codeforces网站 (https://codeforces.com/enter)');
          console.log('登录成功后，请按照提示输入以下信息：');
          
          // 创建readline接口
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          // 获取用户handle
          const handle = await new Promise<string>((resolve) => {
            rl.question('请输入您的Codeforces用户名(handle): ', (answer) => {
              resolve(answer.trim());
            });
          });
          
          if (!handle) {
            console.error('用户名不能为空');
            rl.close();
            process.exit(1);
          }
          
          // 获取cookies
          console.log('\n请从浏览器中复制cookies（可以通过开发者工具 -> Application/Storage -> Cookies获取）');
          console.log('提示：通常需要复制RCPC、39ce7和其他Codeforces相关的cookie');
          const cookies = await new Promise<string>((resolve) => {
            rl.question('请粘贴cookies（格式如：RCPC=xxx; 39ce7=yyy; ...）: ', (answer) => {
              resolve(answer.trim());
            });
          });
          
          rl.close();
          
          if (!cookies) {
            console.error('Cookies不能为空');
            process.exit(1);
          }
          
          // 保存cookies到文件
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          
          const configDir = path.join(os.homedir(), '.cf-tool');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          // 解析cookies字符串为对象数组
          const cookiesArray = cookies.split(';').map(cookie => {
            const [name, value] = cookie.trim().split('=');
            return { name, value };
          });
          
          const cookiesData = {
            cookies: cookiesArray,
            handle: handle,
            timestamp: Date.now()
          };
          
          const cookiesFile = path.join(configDir, 'cookies.json');
          fs.writeFileSync(cookiesFile, JSON.stringify(cookiesData, null, 2));
          
          // 设置cookies到httpClient
          httpClient.setCookies(cookies);
          
          // 验证登录状态
          console.log('正在验证登录状态...');
          const isLoggedIn = await codeforcesAPI.isLoggedIn();
          
          if (isLoggedIn) {
            console.log(`登录成功！欢迎 ${handle}`);
            await saveLoginStatus(handle);
          } else {
            console.error('登录失败：无法验证登录状态，请检查提供的cookies是否正确');
            // 删除保存的cookies文件
            if (fs.existsSync(cookiesFile)) {
              fs.unlinkSync(cookiesFile);
            }
            process.exit(1);
          }
        } catch (error: any) {
          console.error('登录过程中发生错误:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('login')
      .description('登录Codeforces账号')
      .option('-u, --username <username>', '用户名')
      .option('-p, --password <password>', '密码（不推荐在命令行中直接提供）')
      .action(async (options) => {
        try {
          // 首先尝试从保存的cookies文件中加载登录信息
          console.log('尝试从保存的登录信息中恢复登录状态...');
          const loadResult = await codeforcesAPI.loadLoginFromFile();
          
          if (loadResult.success && loadResult.handle) {
            console.log(`已从保存的登录信息中恢复登录状态，欢迎 ${loadResult.handle}!`);
            await saveLoginStatus(loadResult.handle);
            return;
          }
          
          console.log(loadResult.error || '无法从保存的登录信息中恢复登录状态，将使用账号密码登录');
          
          let username = options.username;
          let password = options.password;
          
          // 如果没有提供用户名，则提示输入
          if (!username) {
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            
            username = await new Promise<string>((resolve) => {
              rl.question('请输入用户名: ', (answer) => {
                resolve(answer);
                rl.close();
              });
            });
          }
          
          // 如果没有提供密码，则安全地提示输入
          if (!password) {
            password = await readPassword('请输入密码: ');
          }
          
          if (!username || !password) {
            console.error('用户名和密码不能为空');
            process.exit(1);
          }
          
          console.log(`正在登录账号 ${username}...`);
          
          const credentials: LoginCredentials = {
            handleOrEmail: username,
            password
          };
          
          const result = await codeforcesAPI.login(credentials);
          
          if (result.success) {
            console.log(`登录成功！欢迎 ${result.handle}`);
            await saveLoginStatus(result.handle!);
          } else {
            console.error(`登录失败: ${result.error}`);
            process.exit(1);
          }
        } catch (error: any) {
          console.error('登录过程中发生错误:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('检查登录状态')
      .action(async () => {
        const status = await checkLoginStatus();
        
        if (status.loggedIn) {
          console.log(`当前已登录，用户: ${status.handle}`);
        } else {
          console.log('当前未登录，请使用 cf-tool auth login 命令登录');
        }
      })
  )
  .addCommand(
    new Command('logout')
      .description('退出登录')
      .action(async () => {
        const configDir = path.join(os.homedir(), '.cf-tool');
        const statusFile = path.join(configDir, 'login-status.json');
        
        if (fs.existsSync(statusFile)) {
          fs.unlinkSync(statusFile);
        }
        
        // 清除Cookie
        try {
          await codeforcesAPI.clearCookies();
          
          // 清除配置中的handle
          const config = loadConfig();
          config.handle = '';
          await saveConfig(config);
          
          // 尝试删除cookies文件
          try {
            const cookiesFile = path.join(configDir, 'cookies.json');
            if (fs.existsSync(cookiesFile)) {
              fs.unlinkSync(cookiesFile);
            }
          } catch (e) {
            console.log('清除cookies文件时出错，但不影响退出登录');
          }
          
          console.log('已成功退出登录');
        } catch (error: any) {
          console.error('退出登录时发生错误:', error.message);
          process.exit(1);
        }
      })
  );