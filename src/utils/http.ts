import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getConfig } from '../config/index.js';
import { ApiResponse } from '../types/index.js';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * HTTP客户端类
 */
export class HttpClient {
  private client: AxiosInstance;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private cookies: string[] = [];
  private cookieFile: string;

  constructor() {
    const config = getConfig();
    this.cookieFile = path.join(os.homedir(), '.cf-script', 'cookies.json');
    
    // 确保目录存在
    const dir = path.dirname(this.cookieFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 尝试加载已保存的Cookie
    this.loadCookies();
    
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      withCredentials: true
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        console.log(`Making request to: ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // 重试逻辑
        const appConfig = getConfig();
        if (error.response?.status >= 500 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          for (let i = 0; i < appConfig.api.retryAttempts; i++) {
            try {
              await this.delay(appConfig.api.retryDelay * (i + 1));
              return await this.client(originalRequest);
            } catch (retryError) {
              if (i === appConfig.api.retryAttempts - 1) {
                throw retryError;
              }
            }
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 加载保存的Cookie
   */
  private loadCookies(): void {
    try {
      if (fs.existsSync(this.cookieFile)) {
        const data = fs.readFileSync(this.cookieFile, 'utf8');
        this.cookies = JSON.parse(data);
        console.log('Cookies loaded from file');
      }
    } catch (error) {
      console.error('Error loading cookies:', error);
      this.cookies = [];
    }
  }
  
  /**
   * 保存Cookie到文件
   */
  private saveCookies(): void {
    try {
      fs.writeFileSync(this.cookieFile, JSON.stringify(this.cookies), 'utf8');
      console.log('Cookies saved to file');
    } catch (error) {
      console.error('Error saving cookies:', error);
    }
  }
  
  /**
   * 更新Cookie
   */
  public updateCookies(newCookies: string[]): void {
    if (newCookies && newCookies.length > 0) {
      // 合并Cookie，避免重复
      const cookieMap = new Map<string, string>();
      
      // 处理现有Cookie
      this.cookies.forEach(cookie => {
        const [name] = cookie.split('=');
        cookieMap.set(name, cookie);
      });
      
      // 处理新Cookie
      newCookies.forEach(cookie => {
        const [name] = cookie.split('=');
        cookieMap.set(name, cookie);
      });
      
      // 更新Cookie数组
      this.cookies = Array.from(cookieMap.values());
      
      // 保存到文件
      this.saveCookies();
    }
  }
  
  /**
   * 获取当前Cookie
   */
  public getCookies(): string[] {
    return this.cookies;
  }
  
  /**
   * 设置Cookie
   * @param cookieString Cookie字符串
   */
  public setCookies(cookieString: string): void {
    if (cookieString) {
      const newCookies = cookieString.split('; ');
      this.updateCookies(newCookies);
    }
  }
  
  /**
   * 清除Cookie
   */
  public clearCookies(): void {
    this.cookies = [];
    this.saveCookies();
  }
  
  /**
   * 从HTML中提取CSRF令牌
   */
  public extractCsrfToken(html: string): string | null {
    try {
      const match = html.match(/csrf='(.+?)'/i);
      if (match && match[1]) {
        return match[1];
      }
      return null;
    } catch (error) {
      console.error('Error extracting CSRF token:', error);
      return null;
    }
  }
  
  /**
   * 发送HTTP请求（直接使用axios，不经过API封装）
   */
  public async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    // 添加Cookie到请求头
    if (this.cookies.length > 0) {
      config.headers = config.headers || {};
      config.headers['Cookie'] = this.cookies.join('; ');
    }
    
    try {
      const response = await this.client(config);
      
      // 处理响应中的Set-Cookie头
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        this.updateCookies(setCookieHeaders);
      }
      
      return response;
    } catch (error: any) {
      console.error(`Error in HTTP request to ${config.url}:`, error.message);
      throw error;
    }
  }

  /**
   * 限流请求
   */
  private async rateLimitedRequest<T>(requestFn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const response = await requestFn();
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * 限流设置
   */
  private setupRateLimit(): void {
    const appConfig = getConfig();
    const { requestInterval, burstLimit } = appConfig.api.rateLimit;
    let requestCount = 0;
    let lastRequestTime = 0;

    this.client.interceptors.request.use(async (config) => {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;

      // 如果请求过于频繁，等待
      if (timeSinceLastRequest < requestInterval) {
        await new Promise(resolve => setTimeout(resolve, requestInterval - timeSinceLastRequest));
      }

      // 突发请求限制
      if (requestCount >= burstLimit) {
        await new Promise(resolve => setTimeout(resolve, requestInterval));
        requestCount = 0;
      }

      requestCount++;
      lastRequestTime = Date.now();
      return config;
    });
  }

  /**
   * 处理请求队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    const appConfig = getConfig();
    while (this.requestQueue.length > 0) {
      const requests = this.requestQueue.splice(0, appConfig.api.rateLimit.requests);
      
      await Promise.all(requests.map(request => request()));
      
      if (this.requestQueue.length > 0) {
        await this.delay(appConfig.api.rateLimit.window);
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * GET请求
   */
  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get<ApiResponse<T>>(url, { params })
      );
      return response.data;
    } catch (error: any) {
      console.error(`GET ${url} failed:`, error.message);
      throw error;
    }
  }

  /**
   * POST请求
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.post<ApiResponse<T>>(url, data, config)
      );
      return response.data;
    } catch (error: any) {
      console.error(`POST ${url} failed:`, error.message);
      throw error;
    }
  }
}

// 导出单例实例
export const httpClient = new HttpClient();