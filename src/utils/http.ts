import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getConfig } from '../config/index.js';
import { ApiResponse } from '../types/index.js';

/**
 * HTTP客户端类
 */
export class HttpClient {
  private client: AxiosInstance;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  constructor() {
    const config = getConfig();
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'User-Agent': 'CF-Tool/1.0.0'
      }
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