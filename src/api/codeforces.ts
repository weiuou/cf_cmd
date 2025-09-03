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
  StatementFormat
} from '../types/index.js';

/**
 * Codeforces API 服务类
 */
export class CodeforcesAPI {
  /**
   * 获取竞赛列表
   */
  async getContests(gym: boolean = false): Promise<Contest[]> {
    const cacheKey = `contests_${gym}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<Contest[]>(cacheKey);
    if (cached) {
      console.log('Retrieved contests from cache');
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
      console.error('Error fetching contests:', error.message);
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
      console.log('Retrieved problems from cache');
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
      console.error('Error fetching problems:', error.message);
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
      console.log('Retrieved standings from cache');
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
      console.error('Error fetching contest standings:', error.message);
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(handles: string[]): Promise<User[]> {
    const handlesParam = handles.join(';');
    const cacheKey = `users_${handlesParam}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<User[]>(cacheKey);
    if (cached) {
      console.log('Retrieved user info from cache');
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
      console.error('Error fetching user info:', error.message);
      throw error;
    }
  }

  /**
   * 获取用户提交记录
   */
  async getUserSubmissions(
    handle: string,
    from?: number,
    count?: number
  ): Promise<Submission[]> {
    const cacheKey = `submissions_${handle}_${from || 1}_${count || 0}`;
    
    // 尝试从缓存获取
    const cached = cacheManager.get<Submission[]>(cacheKey);
    if (cached) {
      console.log('Retrieved submissions from cache');
      return cached;
    }

    try {
      const params: any = { handle };
      if (from !== undefined) params.from = from;
      if (count !== undefined) params.count = count;

      const response = await httpClient.get<Submission[]>('/user.status', params);
      
      if (response.status === 'OK' && response.result) {
        // 缓存结果（较短的缓存时间）
        cacheManager.set(cacheKey, response.result, 120 * 1000); // 2分钟
        return response.result;
      } else {
        throw new Error(response.comment || 'Failed to fetch user submissions');
      }
    } catch (error: any) {
      console.error('Error fetching user submissions:', error.message);
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
      console.error('Error fetching contest problems:', error.message);
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
        console.log('Retrieved problem statement from cache');
        return cached;
      }
    }

    // 直接尝试网页抓取获取完整题面
    try {
      console.log('正在使用浏览器抓取...');
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
        console.log('正在访问页面:', url);
         const response = await page.goto(url, { 
           waitUntil: 'domcontentloaded',
           timeout: 30000
         });
         console.log('HTTP状态码:', response?.status());
         // 等待页面完全加载，包括JavaScript渲染
         await page.waitForSelector('.problem-statement', { timeout: 15000 }).catch(() => {
           console.log('等待页面元素加载...');
         });
         
         // 额外等待确保内容完全加载
         await new Promise(resolve => setTimeout(resolve, 3000));
         
         // 获取页面内容
         const content = await page.content();
         console.log('成功获取页面内容，长度:', content.length);
         
         const $ = cheerio.load(content);
         const problemStatement = this.parseProblemStatement($, contestId, index);
         
         console.log('题目解析成功:', problemStatement.name);
        
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