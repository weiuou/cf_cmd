import { httpClient } from '../utils/http.js';
import { cacheManager } from '../utils/cache.js';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import axios from 'axios';
import puppeteer from 'puppeteer';
import {
  Contest,
  Problem,
  User,
  Submission,
  RanklistRow,
  ApiResponse,
  ProblemStatement,
  Sample,
  StatementFormat,
  LoginCredentials,
  LoginResult,
  SubmitCodeParams,
  SubmitResult
} from '../types/index.js';

/**
 * Codeforces API 服务类
 */
export class CodeforcesAPI {
  /**
   * 清除Cookie
   */
  clearCookies(): void {
    httpClient.clearCookies();
  }
  // 生成随机的ftaa字符串
  private generateFtaa(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 18; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  // 存储登录时生成的ftaa和bfaa
  private ftaa: string = '';
  private bfaa: string = 'f1b3f18c715565b589b7823cda7448ce';
  
  /**
   * 检查是否已登录
   * @returns 是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      // 访问个人主页，检查是否已登录
      const response = await httpClient.request({
        method: 'GET',
        url: 'https://codeforces.com/'
      });
      
      // 检查是否包含登录后才会出现的元素
      const isLoggedIn = response.data.includes('logout') || 
                         response.data.includes('class="user-name"') || 
                         response.data.includes('class="lang-chooser"') && 
                         response.data.includes('class="avatar"');
      
      // 检查登录状态
      return isLoggedIn;
    } catch (error) {
      // 检查登录状态时出错
      return false;
    }
  }

  /**
   * 从保存的cookies文件中加载登录信息
   * @returns 加载结果
   */
  async loadLoginFromFile(): Promise<LoginResult> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const configDir = path.join(os.homedir(), '.cf-tool');
      const cookiesFile = path.join(configDir, 'cookies.json');
      
      if (!fs.existsSync(cookiesFile)) {
        return {
          success: false,
          error: '未找到保存的登录信息'
        };
      }
      
      const cookiesData = JSON.parse(fs.readFileSync(cookiesFile, 'utf8'));
      
      // 检查cookies是否过期（超过7天）
      const now = Date.now();
      const cookiesAge = now - cookiesData.timestamp;
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      
      if (cookiesAge > sevenDaysInMs) {
        return {
          success: false,
          error: '登录信息已过期，请重新登录'
        };
      }
      
      // 将cookies设置到httpClient
      const cookieString = cookiesData.cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join('; ');
      httpClient.setCookies(cookieString);
      
      // 验证登录状态
      if (await this.isLoggedIn()) {
        return {
          success: true,
          handle: cookiesData.handle
        };
      } else {
        return {
          success: false,
          error: '登录信息无效，请重新登录'
        };
      }
    } catch (error: any) {
      // 加载登录信息时出错
      return {
        success: false,
        error: `加载登录信息时出错: ${error.message}`
      };
    }
  }
  
  /**
   * 手动登录Codeforces方法已移除
   * 现在使用新的登录方式代替
   */
  
  /**
   * 登录Codeforces
   * @param credentials 登录凭证
   * @returns 登录结果
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      // 清除之前的Cookie
      httpClient.clearCookies();
      
      // 使用浏览器模拟登录
      let browser;
      
      try {
        // 使用Puppeteer启动浏览器 - 非无头模式，让用户可以看到浏览器
        browser = await puppeteer.launch({
          headless: false, // 非无头模式，显示浏览器窗口
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1280,800'
          ]
        });
        
        const page = await browser.newPage();
        
        // 设置用户代理和视口
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0');
        await page.setViewport({ width: 1280, height: 800 });
        
        // 访问登录页面
        console.log('正在访问登录页面...');
        const response = await page.goto('https://codeforces.com/enter', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // HTTP状态码检查
        
        // 自动填写用户名和密码
        if (credentials.handleOrEmail && credentials.password) {
          await page.evaluate((handleOrEmail, password) => {
            const handleInput = document.getElementById('handleOrEmail') as HTMLInputElement;
            const passwordInput = document.getElementById('password') as HTMLInputElement;
            const rememberInput = document.getElementById('remember') as HTMLInputElement;
            
            if (handleInput) handleInput.value = handleOrEmail;
            if (passwordInput) passwordInput.value = password;
            if (rememberInput) rememberInput.checked = true;
          }, credentials.handleOrEmail, credentials.password);
        }
        
        // 等待用户在浏览器中完成登录操作
        
        // 等待用户在浏览器中完成登录
        // 等待重定向到主页或用户页面，表示登录成功
        await Promise.race([
          page.waitForNavigation({ timeout: 120000 }), // 等待导航完成，最多等待2分钟
          page.waitForSelector('.lang-chooser a.user-name', { timeout: 120000 }) // 等待用户名元素出现
        ]);
        
        // 等待一下确保页面加载完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查是否登录成功
        const isLoggedIn = await page.evaluate(() => {
          // 检查是否有用户名元素
          const userElement = document.querySelector('.lang-chooser a.user-name') as HTMLElement;
          if (userElement) {
            return { success: true, handle: userElement.textContent?.trim() };
          }
          
          // 尝试从页面内容中提取handle
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const content = script.textContent || '';
            const match = content.match(/handle = "([^"]+)"/i);
            if (match && match[1]) {
              return { success: true, handle: match[1] };
            }
          }
          
          return { success: false, error: '无法确定登录状态' };
        });
        
        // 登录状态检查结果
        
        if (isLoggedIn.success && isLoggedIn.handle) {
          // 提取Cookies
          const cookies = await page.cookies();
          const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
          
          // 将Cookies设置到httpClient
          httpClient.setCookies(cookieString);
          
          // 保存cookies到文件
          const cookiesData = {
            cookies: cookies,
            handle: isLoggedIn.handle,
            timestamp: Date.now()
          };
          
          // 保存cookies到文件
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          
          const configDir = path.join(os.homedir(), '.cf-tool');
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          const cookiesFile = path.join(configDir, 'cookies.json');
          fs.writeFileSync(cookiesFile, JSON.stringify(cookiesData, null, 2));
          // Cookies已保存到文件
          
          // 成功登录
          await browser.close();
          
          return {
            success: true,
            handle: isLoggedIn.handle,
            cookies: cookieString
          };
        } else {
          // 登录失败
          await browser.close();
          return {
            success: false,
            error: isLoggedIn.error || '登录失败，请检查用户名和密码'
          };
        }
      } catch (puppeteerError: any) {
        // 浏览器模拟登录错误
        if (browser) {
          await browser.close();
        }
        throw puppeteerError;
      }
    } catch (error: any) {
      // 登录过程中发生错误
      return {
        success: false,
        error: `登录过程中发生错误: ${error.message}`
      };
    }
  }
  /**
   * 获取竞赛列表
   */
  async getContests(gym: boolean = false): Promise<Contest[]> {
    const cacheKey = `contests_${gym}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<Contest[]>(cacheKey);
    if (cached) {
      // 从缓存获取竞赛列表
      return cached;
    }

    try {
      const response = await httpClient.get<Contest[]>('/contest.list', { gym });
      
      if (response.status === 'OK' && response.result) {
        // 缓存结果
        cacheManager.set(cacheKey, response.result);
        return response.result;
      } else {
        throw new Error(response.comment || 'Failed to fetch contests');
      }
    } catch (error: any) {
      // 获取竞赛列表出错
      throw error;
    }
  }

  /**
   * 获取题目列表
   */
  async getProblems(tags?: string[]): Promise<{ problems: Problem[]; problemStatistics: any[] }> {
    const tagsParam = tags ? tags.join(';') : undefined;
    const cacheKey = `problems_${tagsParam || 'all'}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<{ problems: Problem[]; problemStatistics: any[] }>(cacheKey);
    if (cached) {
      // 从缓存获取题目列表
      return cached;
    }

    try {
      const params: any = {};
      if (tagsParam) {
        params.tags = tagsParam;
      }

      const response = await httpClient.get<{ problems: Problem[]; problemStatistics: any[] }>('/problemset.problems', params);
      
      if (response.status === 'OK' && response.result) {
        // 缓存结果
        cacheManager.set(cacheKey, response.result);
        return response.result;
      } else {
        throw new Error(response.comment || 'Failed to fetch problems');
      }
    } catch (error: any) {
      // 获取题目列表出错
      throw error;
    }
  }

  /**
   * 获取竞赛排名
   */
  async getContestStandings(
    contestId: number,
    from?: number,
    count?: number,
    handles?: string[]
  ): Promise<{ contest: Contest; problems: Problem[]; rows: RanklistRow[] }> {
    const cacheKey = `standings_${contestId}_${from || 1}_${count || 0}_${handles?.join(',') || 'all'}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<{ contest: Contest; problems: Problem[]; rows: RanklistRow[] }>(cacheKey);
    if (cached) {
      // 从缓存获取排名
      return cached;
    }

    try {
      const params: any = { contestId };
      if (from !== undefined) params.from = from;
      if (count !== undefined) params.count = count;
      if (handles && handles.length > 0) params.handles = handles.join(';');

      const response = await httpClient.get<{ contest: Contest; problems: Problem[]; rows: RanklistRow[] }>('/contest.standings', params);
      
      if (response.status === 'OK' && response.result) {
        // 缓存结果（较短的缓存时间，因为排名可能变化）
        cacheManager.set(cacheKey, response.result, 60 * 1000); // 1分钟
        return response.result;
      } else {
        throw new Error(response.comment || 'Failed to fetch contest standings');
      }
    } catch (error: any) {
      // 获取竞赛排名出错
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  /**
   * 提交代码
   * @param params 提交参数
   * @returns 提交结果
   */
  /**
   * 使用Puppeteer模拟浏览器提交代码
   * @param params 提交参数
   * @returns 提交结果
   */
  async submitCodeWithPuppeteer(params: SubmitCodeParams): Promise<SubmitResult> {
    try {
      // 检查是否已登录
      if (!httpClient.getCookies().length) {
        return {
          success: false,
          error: '请先登录再提交代码'
        };
      }
      
      // 启动浏览器模拟提交代码
      let browser;
      
      try {
        // 启动浏览器
        browser = await puppeteer.launch({
          headless: true, 
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        });
        
        const page = await browser.newPage();
        
        // 设置用户代理
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');
        
        // 设置cookies
        const cookies = httpClient.getCookies().map(cookie => {
          const [name, value] = cookie.split('=');
          return { name, value, domain: 'codeforces.com', path: '/' };
        });
        
        await page.setCookie(...cookies);
        
        // 构建提交URL
        let submitUrl = '';
        if (params.groupId) {
          // 小组比赛
          submitUrl = `/group/${params.groupId}/contest/${params.contestId}/submit`;
        } else {
          // 普通比赛
          submitUrl = `/contest/${params.contestId}/submit`;
        }
        
        // 访问提交页面
        await page.goto(`https://codeforces.com${submitUrl}`, {
          waitUntil: 'networkidle2',
          timeout: 60000 // 增加超时时间到60秒
        });
        
        // 等待页面加载完成，使用更通用的选择器
        await page.waitForSelector('form', { timeout: 30000 });
        
        // 额外等待一段时间，确保页面完全加载
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 分析页面表单元素
        const formElements = await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          return Array.from(forms).map(form => ({
            id: form.id,
            className: form.className,
            action: form.action,
            method: form.method,
            elements: Array.from(form.elements).map(el => ({
              name: (el as any).name,
              id: (el as any).id,
              type: (el as any).type,
              tagName: (el as any).tagName
            }))
          }));
        });
        
        // 选择题目 - 使用更通用的选择器
        try {
          await page.select('select[name="submittedProblemIndex"]', params.problemIndex);
        } catch (e) {
          // 选择题目失败，尝试备用方法
          // 备用方法：使用页面评估
          await page.evaluate((problemIndex) => {
            const selects = document.querySelectorAll('select');
            for (const select of selects) {
              if (select.name === 'submittedProblemIndex' || 
                  select.id === 'submittedProblemIndex' || 
                  Array.from(select.options).some(opt => opt.value === problemIndex)) {
                select.value = problemIndex;
                return;
              }
            }
          }, params.problemIndex);
        }
        
        // 选择编程语言 - 使用更通用的选择器
        try {
          await page.select('select[name="programTypeId"]', params.programTypeId.toString());
        } catch (e) {
          // 选择语言失败，尝试备用方法
          // 备用方法：使用页面评估
          await page.evaluate((programTypeId) => {
            const selects = document.querySelectorAll('select');
            for (const select of selects) {
              if (select.name === 'programTypeId' || 
                  select.id === 'programTypeId' || 
                  Array.from(select.options).some(opt => opt.value === programTypeId)) {
                select.value = programTypeId;
                return;
              }
            }
          }, params.programTypeId.toString());
        }
        
        // 输入代码 - 使用更直接的方法，优先使用ID
        try {
          // 首先尝试使用ID选择器，这是从页面分析中发现的
          const sourceTextareaSelector = '#sourceCodeTextarea';
          await page.waitForSelector(sourceTextareaSelector, { timeout: 10000 });
          
          // 清除现有内容
          await page.evaluate(() => {
            const textarea = document.querySelector('#sourceCodeTextarea') as HTMLTextAreaElement;
            if (textarea) {
              textarea.value = '';
            }
          });
          
          // 直接输入代码
          await page.focus(sourceTextareaSelector);
          await page.type(sourceTextareaSelector, params.source, { delay: 10 });
          
          // 验证代码是否正确设置
          const codeLength = await page.evaluate(() => {
            const textarea = document.querySelector('#sourceCodeTextarea') as HTMLTextAreaElement;
            return textarea ? textarea.value.length : 0;
          });
          
          // 成功设置代码
          
          // 如果代码长度不匹配，尝试使用clipboard粘贴
          if (codeLength !== params.source.length) {
            // 代码长度不匹配，尝试使用clipboard粘贴
            await page.evaluate((source) => {
              const textarea = document.querySelector('#sourceCodeTextarea') as HTMLTextAreaElement;
              if (textarea) {
                textarea.value = source;
              }
            }, params.source);
            
            // 再次验证
            const newCodeLength = await page.evaluate(() => {
              const textarea = document.querySelector('#sourceCodeTextarea') as HTMLTextAreaElement;
              return textarea ? textarea.value.length : 0;
            });
            
            // 使用clipboard后代码长度检查
          }
        } catch (e) {
          // 直接输入代码失败，尝试备用方法
          
          // 备用方法：使用evaluate
          const codeSet = await page.evaluate((source) => {
            // 尝试多种可能的选择器
            const textareas = document.querySelectorAll('textarea');
            let sourceTextarea = null;
            
            // 首先尝试通过name或id查找
            for (const textarea of textareas) {
              if (textarea.name === 'source' || textarea.id === 'sourceCodeTextarea') {
                sourceTextarea = textarea;
                break;
              }
            }
            
            // 如果没找到，尝试第一个textarea
            if (!sourceTextarea && textareas.length > 0) {
              sourceTextarea = textareas[0];
            }
            
            // 设置代码
            if (sourceTextarea) {
              sourceTextarea.value = source;
              return true;
            }
            return false;
          }, params.source);
          
          if (codeSet) {
            // 使用备用方法成功设置代码
          } else {
            // 未找到代码输入框
          }
        }
        
        // 额外等待，确保代码设置完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 勾选确认代码 - 使用更通用的选择器
        try {
          // 尝试多种可能的选择器
          const confirmCheckbox = await page.evaluate(() => {
            // 尝试通过name查找
            let checkbox = document.querySelector('input[name="sourceCodeConfirmed"]');
            if (checkbox) return true;
            
            // 尝试通过id查找
            checkbox = document.querySelector('#sourceCodeConfirmed');
            if (checkbox) return true;
            
            // 尝试通过类型和文本查找
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            for (const cb of checkboxes) {
              const label = cb.parentElement?.textContent || '';
              if (label.toLowerCase().includes('confirm') || label.toLowerCase().includes('确认')) {
                (cb as HTMLInputElement).checked = true;
                return true;
              }
            }
            
            return false;
          });
          
          if (confirmCheckbox) {
            // 成功勾选确认代码复选框
          } else {
            // 未找到确认代码复选框，继续提交
          }
        } catch (e) {
          // 勾选确认代码失败，继续提交
        }
        
        // 提交表单
        
        // 查找并点击提交按钮 - 直接使用ID
        
        try {
          // 获取页面上所有按钮信息
          const buttonInfo = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
            return Array.from(buttons).map(btn => {
              const text = btn.textContent || (btn as HTMLInputElement).value || '';
              return `按钮: ${text} - 类型: ${btn.tagName} - ID: ${btn.id} - 类: ${btn.className}`;
            });
          });
          
          // 直接使用ID选择器点击提交按钮
          const submitButtonSelector = '#singlePageSubmitButton';
          await page.waitForSelector(submitButtonSelector, { timeout: 10000 });
          
          // 找到提交按钮
          
          // 确保表单验证通过
          await page.evaluate(() => {
            // 检查是否有sourceCodeConfirmed复选框，如果有则勾选
            const confirmCheckbox = document.querySelector('input[name="sourceCodeConfirmed"]') as HTMLInputElement;
            if (confirmCheckbox) {
              confirmCheckbox.checked = true;
            }
            
            // 确保代码已设置
            const textarea = document.querySelector('#sourceCodeTextarea') as HTMLTextAreaElement;
            if (textarea && !textarea.value) {
              // 代码输入框为空
            }
          });
          
          // 额外等待，确保所有操作完成
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 创建一个Promise，在点击按钮的同时等待导航
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(e => {
              // 等待导航超时
            }),
            page.click(submitButtonSelector)
          ]);
          
          // 成功点击提交按钮
          
          // 额外等待一段时间，确保页面完全加载
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (e) {
          // 点击提交按钮过程中出错
          
          // 备用方法：使用evaluate直接提交表单
          
          const formSubmitted = await page.evaluate(() => {
            // 尝试提交表单
            const form = document.querySelector('form');
            if (form) {
              form.submit();
              return true;
            }
            return false;
          });
          
          if (formSubmitted) {
            // 使用表单提交方法成功提交
            // 等待导航完成
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(e => {
              // 等待导航超时，继续检查提交结果
            });
            
            // 额外等待一段时间，确保页面完全加载
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            // 所有提交方法均失败
          }
        }
        
        // 检查是否提交成功
        const currentUrl = page.url();
        
        // 等待一段时间，确保页面完全加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查是否跳转到我的提交页面
        if (currentUrl.includes('/my') || currentUrl.includes('/status') || currentUrl.includes('/submissions')) {
          // 代码提交成功
          
          // 尝试获取提交ID
          const submissionId = await page.evaluate(() => {
            const rows = document.querySelectorAll('table.status-frame-datatable tr');
            if (rows.length > 1) {
              const firstRow = rows[1];
              const idCell = firstRow.querySelector('td:first-child');
              if (idCell && idCell.textContent) {
                return idCell.textContent.trim();
              }
            }
            return null;
          });
          
          await browser.close();
          
          return {
            success: true,
            submissionId: submissionId ? parseInt(submissionId) : undefined
          };
        }
        
        // 如果跳转到首页，可能是登录状态已过期
        if (currentUrl === 'https://codeforces.com/' || currentUrl === 'https://codeforces.com') {
          // 提交后跳转到首页，可能需要重新登录
          // 尝试查看页面内容，检查是否有登录按钮
          const needLogin = await page.evaluate(() => {
            const loginLink = document.querySelector('a[href="/enter"]');
            return !!loginLink;
          });
          
          if (needLogin) {
            await browser.close();
            return {
              success: false,
              error: '登录状态已过期，请重新登录'
            };
          }
        }
        
        // 检查错误信息
        const errorMessage = await page.evaluate(() => {
          // 尝试多种可能的错误元素选择器
          const errorSelectors = [
            '.error', 
            '.alert-error', 
            '.alert-danger',
            '.error-message',
            'div[class*="error"]',
            'span[class*="error"]'
          ];
          
          for (const selector of errorSelectors) {
            const errorElement = document.querySelector(selector);
            if (errorElement && errorElement.textContent) {
              return errorElement.textContent.trim();
            }
          }
          
          // 检查页面内容中是否包含错误信息
          const bodyText = document.body.textContent || '';
          if (bodyText.includes('error') || bodyText.includes('Error') || 
              bodyText.includes('失败') || bodyText.includes('错误')) {
            // 尝试提取错误上下文
            const errorContext = bodyText.split(/error|Error|失败|错误/)[1]?.substring(0, 100) || '';
            return `可能的错误信息: ${errorContext}`;
          }
          
          return null;
        });
        
        // 保存页面截图
        try {
          await page.screenshot({ path: 'submission_error.png' });
        } catch (e) {
          // 保存截图失败
        }
        
        await browser.close();
        
        if (errorMessage) {
          // 提交失败
          return {
            success: false,
            error: errorMessage
          };
        }
        
        return {
          success: false,
          error: '提交失败，但未找到具体错误信息'
        };
      } catch (puppeteerError: any) {
        // 浏览器模拟提交错误
        if (browser) {
          await browser.close();
        }
        throw puppeteerError;
      }
    } catch (error: any) {
      // 提交过程中发生错误
      return {
        success: false,
        error: `提交过程中发生错误: ${error.message}`
      };
    }
  }
  
  /**
   * 提交代码到Codeforces
   * @param params 提交参数
   * @returns 提交结果
   */
  async submitCode(params: SubmitCodeParams): Promise<SubmitResult> {
    // 使用Puppeteer模拟浏览器提交代码
    return this.submitCodeWithPuppeteer(params);
  }
  
  async getUserInfo(handles: string[]): Promise<User[]> {
    const handlesParam = handles.join(';');
    const cacheKey = `users_${handlesParam}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<User[]>(cacheKey);
    if (cached) {
      // 从缓存获取用户信息
      return cached;
    }

    try {
      const response = await httpClient.get<User[]>('/user.info', { handles: handlesParam });
      
      if (response.status === 'OK' && response.result) {
        // 缓存结果
        cacheManager.set(cacheKey, response.result);
        return response.result;
      } else {
        throw new Error(response.comment || 'Failed to fetch user info');
      }
    } catch (error: any) {
      // 获取用户信息出错
      throw error;
    }
  }

  /**
   * 获取用户提交记录
   * @param handle 用户名
   * @param from 起始位置
   * @param count 返回数量
   * @param useCache 是否使用缓存，默认为false。当为false时跳过缓存读取，直接从网络获取最新内容
   */
  async getUserSubmissions(
    handle: string,
    from?: number,
    count?: number,
    useCache: boolean = false
  ): Promise<Submission[]> {
    const cacheKey = `submissions_${handle}_${from || 1}_${count || 0}`;
    
    // 只有当useCache为true时才尝试从缓存获取
    if (useCache) {
      const cached = cacheManager.get<Submission[]>(cacheKey);
      if (cached) {
        // 从缓存获取提交记录
        return cached;
      }
    }

    try {
      const params: any = { handle };
      if (from !== undefined) params.from = from;
      if (count !== undefined) params.count = count;

      const response = await httpClient.get<Submission[]>('/user.status', params);
      
      if (response.status === 'OK' && response.result) {
        // 只有当useCache为true时才缓存结果
        if (useCache) {
          cacheManager.set(cacheKey, response.result, 120 * 1000); // 2分钟
        }
        return response.result;
      } else {
        throw new Error(response.comment || 'Failed to fetch user submissions');
      }
    } catch (error: any) {
      // 获取用户提交记录出错
      throw error;
    }
  }

  /**
   * 获取竞赛中的题目列表
   */
  async getContestProblems(contestId: number): Promise<Problem[]> {
    try {
      const standings = await this.getContestStandings(contestId, 1, 1);
      return standings.problems;
    } catch (error: any) {
      // 获取竞赛题目出错
      throw error;
    }
  }

  /**
   * 获取题目题面
   * @param contestId 竞赛ID
   * @param index 题目编号
   * @param useCache 是否使用缓存，默认为true。当为false时跳过缓存读取，直接从网络获取最新内容
   */
  async getProblemStatement(contestId: number, index: string, useCache: boolean = true): Promise<ProblemStatement> {
    const cacheKey = `statement_${contestId}_${index}`;
    
    // 只有当useCache为true时才尝试从缓存获取
    if (useCache) {
      const cached = cacheManager.get<ProblemStatement>(cacheKey);
      if (cached) {
        // 从缓存获取题目描述
        return cached;
      }
    }

    // 直接尝试网页抓取获取完整题面
    try {
      // 使用浏览器抓取
      const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;
      
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        const page = await browser.newPage();
        // 设置用户代理和视口
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0');
        await page.setViewport({ width: 1920, height: 1080 });
        // 设置额外的请求头
        await page.setExtraHTTPHeaders({
          'sec-ch-ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'upgrade-insecure-requests': '1',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        });
        // 访问页面
         const response = await page.goto(url, { 
           waitUntil: 'domcontentloaded',
           timeout: 30000
         });
         console.log('HTTP状态码:', response?.status());
         // 等待页面完全加载，包括JavaScript渲染
         await page.waitForSelector('.problem-statement', { timeout: 15000 }).catch(() => {
           // 等待页面元素加载
         });
         
         // 额外等待确保内容完全加载
         await new Promise(resolve => setTimeout(resolve, 3000));
         
         // 获取页面内容
         const content = await page.content();
         // 成功获取页面内容
         
         const $ = cheerio.load(content);
         const problemStatement = this.parseProblemStatement($, contestId, index);
         
         // 题目解析成功
        
        await browser.close();
        
        // 缓存结果
        cacheManager.set(cacheKey, problemStatement);
        return problemStatement;
        
      } catch (puppeteerError) {
        console.error('Puppeteer错误:', puppeteerError);
        if (browser) {
          await browser.close();
        }
        throw puppeteerError;
      }
    } catch (error: any) {
      console.error('网页抓取也失败了:', error.message);
      
      // 返回一个基本的错误信息
      const errorStatement: ProblemStatement = {
        contestId,
        index,
        name: `题目 ${contestId}${index}`,
        timeLimit: '未知',
        memoryLimit: '未知',
        statement: `<p>抱歉，由于网络限制无法获取题目内容。</p><p>请直接访问: <a href="https://codeforces.com/contest/${contestId}/problem/${index}" target="_blank">https://codeforces.com/contest/${contestId}/problem/${index}</a></p><p>错误信息: ${error.message}</p>`,
        inputFormat: '请访问原网站查看',
        outputFormat: '请访问原网站查看',
        samples: [],
        note: undefined
      };
      
      return errorStatement;
    }
  }

  /**
   * 解析题面HTML
   */
  private parseProblemStatement($: cheerio.CheerioAPI, contestId: number, index: string): ProblemStatement {
    // 获取题目名称 - 从 .header .title 中获取
    const nameElement = $('.ttypography .problem-statement .header .title');
    let name = nameElement.text().trim();
    // 移除题目编号前缀（如 "A. "）
    name = name.replace(/^[A-Z]\. /, '') || `题目 ${contestId}${index}`;
    // 获取时间和内存限制
    const timeLimitElement = $('.ttypography .problem-statement .header .time-limit');
    const memoryLimitElement = $('.ttypography .problem-statement .header .memory-limit');
    // 提取时间限制，格式如 "1 second"
    let timeLimit = '未知';
    if (timeLimitElement.length > 0) {
      const timeLimitText = timeLimitElement.text();
      const timeMatch = timeLimitText.match(/\d+\s*(second|millisecond)s?/i);
      timeLimit = timeMatch ? timeMatch[0] : timeLimitText.replace('time limit per test', '').trim();
    }
    // 提取内存限制，格式如 "256 megabytes"
    let memoryLimit = '未知';
    if (memoryLimitElement.length > 0) {
      const memoryLimitText = memoryLimitElement.text();
      const memoryMatch = memoryLimitText.match(/\d+\s*(megabyte|kilobyte|gigabyte)s?/i);
      memoryLimit = memoryMatch ? memoryMatch[0] : memoryLimitText.replace('memory limit per test', '').trim();
    }
    // 获取题目描述 - 在 .header 后的第一个 div 中
    let statement = '';
    const problemStatementDiv = $('.ttypography .problem-statement');
    if (problemStatementDiv.length > 0) {
      // 获取 .header 后的第一个 div 元素
      const headerElement = problemStatementDiv.find('.header');
      const statementElement = headerElement.next('div');
      
      if (statementElement.length > 0) {
        statement = statementElement.html() || '';
      }
    }
    // 获取输入格式
    const inputFormatElement = $('.ttypography .problem-statement .input-specification');
    let inputFormat = '';
    if (inputFormatElement.length > 0) {
      const clonedInput = inputFormatElement.clone();
      clonedInput.find('.section-title').remove();
      inputFormat = clonedInput.html() || '无特殊说明';
    }
    // 获取输出格式
    const outputFormatElement = $('.ttypography .problem-statement .output-specification');
    let outputFormat = '';
    if (outputFormatElement.length > 0) {
      const clonedOutput = outputFormatElement.clone();
      clonedOutput.find('.section-title').remove();
      outputFormat = clonedOutput.html() || '无特殊说明';
    }
    // 获取样例 - 从 .sample-tests 中提取
    const samples: Sample[] = [];
    const sampleTests = $('.ttypography .problem-statement .sample-tests');
    if (sampleTests.length > 0) {
      // 查找样例测试容器
      const sampleTest = sampleTests.find('.sample-test');
      if (sampleTest.length > 0) {
        const inputDiv = sampleTest.find('.input pre');
        const outputDiv = sampleTest.find('.output pre');
        if (inputDiv.length > 0 && outputDiv.length > 0) {
          // 提取输入，正确处理test-example-line div标签
          const inputLines = inputDiv.find('.test-example-line');
          let input = '';
          if (inputLines.length > 0) {
            // 分别提取每个test-example-line div的文本内容
            const lines: string[] = [];
            inputLines.each((index, element) => {
              const lineText = $(element).text().trim();
              if (lineText) {
                lines.push(lineText);
              }
            });
            input = lines.join('\n');
          } else {
            // 备用方案：直接获取文本内容
            input = inputDiv.text().trim();
          }
          
          // 提取输出
          let output = outputDiv.text().trim();
          
          if (input || output) {
            samples.push({ input, output });
          }
        }
      } else {
        // 备用方案：直接查找 .input 和 .output
        const inputs = sampleTests.find('.input pre');
        const outputs = sampleTests.find('.output pre');
        
        const minLength = Math.min(inputs.length, outputs.length);
        for (let i = 0; i < minLength; i++) {
          // 提取输入，正确处理test-example-line div标签
          const inputDiv = $(inputs[i]);
          const inputLines = inputDiv.find('.test-example-line');
          let input = '';
          if (inputLines.length > 0) {
            // 分别提取每个test-example-line div的文本内容
            const lines: string[] = [];
            inputLines.each((index, element) => {
              const lineText = $(element).text().trim();
              if (lineText) {
                lines.push(lineText);
              }
            });
            input = lines.join('\n');
          } else {
            // 备用方案：直接获取文本内容
            input = inputDiv.text().trim();
          }
          
          let output = $(outputs[i]).text().trim();
          
          // 移除可能的行号标记
          input = input.replace(/^\d+\s*/gm, '');
          
          samples.push({ input, output });
        }
      }
    }


    // 获取注释
    const noteElement = $('.ttypography .problem-statement .note');
    let note: string | undefined;
    if (noteElement.length > 0) {
      const clonedNote = noteElement.clone();
      clonedNote.find('.section-title').remove();
      const noteContent = clonedNote.html()?.trim();
      note = noteContent || undefined;
    }
    return {
      contestId,
      index,
      name,
      timeLimit,
      memoryLimit,
      statement,
      inputFormat,
      outputFormat,
      samples,
      note
    };
  }

  /**
   * 将题面转换为指定格式
   */
  formatProblemStatement(statement: ProblemStatement, format: StatementFormat): string {
    // console.log(statement.statement);
    if (format === StatementFormat.MARKDOWN) {
      console.log("markdown格式");
      let markdown = `# ${statement.name || '未知题目'}\n\n`;
      
      // 时间和内存限制
      if (statement.timeLimit && statement.timeLimit !== '未知') {
        markdown += `**Time Limit:** ${statement.timeLimit}\n`;
      }
      if (statement.memoryLimit && statement.memoryLimit !== '未知') {
        markdown += `**Memory Limit:** ${statement.memoryLimit}\n`;
      }
      markdown += '\n';
      
      // 题目描述
      if (statement.statement && statement.statement !== '题目描述获取失败') {
        markdown += '## Problem Statement\n\n';
        const statementMd = htmlToMarkdown(statement.statement);
        if (statementMd) {
          markdown += statementMd + '\n\n';
        }
      }
      
      // 输入格式
      if (statement.inputFormat && statement.inputFormat !== '输入格式获取失败') {
        markdown += '## Input Format\n\n';
        const inputMd = htmlToMarkdown(statement.inputFormat);
        if (inputMd) {
          markdown += inputMd + '\n\n';
        }
      }
      
      // 输出格式
      if (statement.outputFormat && statement.outputFormat !== '输出格式获取失败') {
        markdown += '## Output Format\n\n';
        const outputMd = htmlToMarkdown(statement.outputFormat);
        if (outputMd) {
          markdown += outputMd + '\n\n';
        }
      }
      
      // 样例
      if (statement.samples.length > 0) {
        markdown += `## Sample Tests\n\n`;
        statement.samples.forEach((sample, index) => {
          markdown += `### Sample ${index + 1}\n\n`;
          
          if (sample.input) {
            markdown += '**Input:**\n```\n' + sample.input + '\n```\n\n';
          }
          
          if (sample.output) {
            markdown += '**Output:**\n```\n' + sample.output + '\n```\n\n';
          }
        });
      }
      
      // 注释
      if (statement.note) {
        markdown += '## Note\n\n';
        const noteMd = htmlToMarkdown(statement.note);
        if (noteMd) {
          markdown += noteMd + '\n\n';
        }
      }
      
      // 清理最终的markdown
      return markdown
        // .replace(/\n{3,}/g, '\n\n') // 移除多余的空行
        .trim();
    } else {
      // HTML格式
      let html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${statement.name}</title>\n</head>\n<body>\n`;
      html += `<h1>${statement.name}</h1>\n`;
      html += `<p><strong>Time Limit:</strong> ${statement.timeLimit}</p>\n`;
      html += `<p><strong>Memory Limit:</strong> ${statement.memoryLimit}</p>\n`;
      
      if (statement.statement) {
        html += `<h2>Problem Statement</h2>\n${statement.statement}\n`;
      }
      
      if (statement.inputFormat) {
        html += `<h2>Input Format</h2>\n${statement.inputFormat}\n`;
      }
      
      if (statement.outputFormat) {
        html += `<h2>Output Format</h2>\n${statement.outputFormat}\n`;
      }
      
      if (statement.samples.length > 0) {
        html += `<h2>Sample Tests</h2>\n`;
        statement.samples.forEach((sample, index) => {
          html += `<h3>Sample ${index + 1}</h3>\n`;
          html += `<p><strong>Input:</strong></p>\n<pre>${sample.input}</pre>\n`;
          html += `<p><strong>Output:</strong></p>\n<pre>${sample.output}</pre>\n`;
        });
      }
      
      if (statement.note) {
        html += `<h2>Note</h2>\n${statement.note}\n`;
      }
      
      html += `</body>\n</html>`;
      return html;
    }
  }
}

// 导出单例实例
export const codeforcesAPI = new CodeforcesAPI();

function htmlToMarkdown(html: string): string {
  
  // 第一步：专门处理MathJax公式结构
  function processMathJax(html: string): string {
    let result = html;
    
    // 1. 提取并保留 script type="math/tex" 中的纯文本数学公式
    const mathTexScripts: string[] = [];
    result = result.replace(/<script type="math\/tex"[^>]*>(.*?)<\/script>/gi, (match, content) => {
      let cleanContent = content.trim();
      // 包裹公式为$$
      cleanContent = `$${cleanContent}$`;
      mathTexScripts.push(cleanContent);
      return `__MATHJAX_FORMULA_${mathTexScripts.length - 1}__`;
    });
    //移除全部的span标签及其内容
    result = result.replace(/<span[^>]*>.*?<\/span>/gi, '');
    //移除全部</span>标签
    result = result.replace(/<\/span>/gi, '');
    // 移除nobr标签但保留内容
    result = result.replace(/<nobr[^>]*>(.*?)<\/nobr>/gi, '$1');
    // 移除全部</nobr>标签
    result = result.replace(/<\/nobr>/gi, '');
    // 3. 恢复纯文本数学公式并用$包裹
    mathTexScripts.forEach((formula, index) => {
      result = result.replace(`__MATHJAX_FORMULA_${index}__`, `$${formula}$`);
    });
    
    return result;
  }
  
  // 第二步：自定义HTML到文本转换，避免过度转义
  function htmlToText(html: string): string {
    let text = html;
    
    // 处理段落和换行
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    
    // 处理标题
    text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1\n\n');
    
    // 处理列表
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<ul[^>]*>/gi, '');
    text = text.replace(/<\/ol>/gi, '\n');
    text = text.replace(/<ol[^>]*>/gi, '');
    
    // 处理强调
    text = text.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
    text = text.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
    
    // 处理代码
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```');
    
    // 处理链接（保留文本，去掉链接）
    text = text.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
    
    // 移除所有剩余的HTML标签
    text = text.replace(/<[^>]*>/g, '');
    
    // 解码HTML实体
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    
    // 清理多余的空行
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();
    
    return text;
  }
  
  // 预处理HTML
  let processedHtml = processMathJax(html);
  
  // 转换为文本
  let result = htmlToText(processedHtml);
  
  return result;
}