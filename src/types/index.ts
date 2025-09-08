// Codeforces API 数据类型定义

// 登录相关接口定义
export interface LoginCredentials {
  handleOrEmail: string;
  password: string;
  remember?: boolean;
}

export interface LoginResult {
  success: boolean;
  handle?: string;
  error?: string;
  cookies?: string[];
}

// 提交代码相关接口定义
export interface SubmitCodeParams {
  contestId: number;
  problemIndex: string; // 如 'A', 'B1' 等
  source: string;
  programTypeId: number; // 编程语言ID
  groupId?: string; // 小组比赛ID
}

export interface SubmitResult {
  success: boolean;
  submissionId?: number;
  error?: string;
}

// Contest接口定义
export interface Contest {
  id: number;
  name: string;
  type: 'CF' | 'IOI' | 'ICPC';
  phase: 'BEFORE' | 'CODING' | 'PENDING_SYSTEM_TEST' | 'SYSTEM_TEST' | 'FINISHED';
  frozen: boolean;
  durationSeconds: number;
  startTimeSeconds?: number;
  relativeTimeSeconds?: number;
  preparedBy?: string;
  websiteUrl?: string;
  description?: string;
  difficulty?: number;
  kind?: string;
  icpcRegion?: string;
  country?: string;
  city?: string;
  season?: string;
}

// Problem接口定义
export interface Problem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: 'PROGRAMMING' | 'QUESTION';
  points?: number;
  rating?: number;
  tags: string[];
}

// User接口定义
export interface User {
  handle: string;
  email?: string;
  vkId?: string;
  openId?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution: number;
  rank?: string;
  rating?: number;
  maxRank?: string;
  maxRating?: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
  friendOfCount: number;
  avatar: string;
  titlePhoto: string;
}

// Party接口定义
export interface Party {
  contestId?: number;
  members: Member[];
  participantType: 'CONTESTANT' | 'PRACTICE' | 'VIRTUAL' | 'MANAGER' | 'OUT_OF_COMPETITION';
  teamId?: number;
  teamName?: string;
  ghost: boolean;
  room?: number;
  startTimeSeconds?: number;
}

// Member接口定义
export interface Member {
  handle: string;
  name?: string;
}

// Submission接口定义
export interface Submission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: Problem;
  author: Party;
  programmingLanguage: string;
  verdict?: 'FAILED' | 'OK' | 'PARTIAL' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'WRONG_ANSWER' | 'PRESENTATION_ERROR' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'IDLENESS_LIMIT_EXCEEDED' | 'SECURITY_VIOLATED' | 'CRASHED' | 'INPUT_PREPARATION_CRASHED' | 'CHALLENGED' | 'SKIPPED' | 'TESTING' | 'REJECTED';
  testset: 'SAMPLES' | 'PRETESTS' | 'TESTS' | 'CHALLENGES' | 'TESTS1' | 'TESTS2' | 'TESTS3' | 'TESTS4' | 'TESTS5' | 'TESTS6' | 'TESTS7' | 'TESTS8' | 'TESTS9' | 'TESTS10';
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
  points?: number;
}

// RanklistRow接口定义
export interface RanklistRow {
  party: Party;
  rank: number;
  points: number;
  penalty: number;
  successfulHackCount: number;
  unsuccessfulHackCount: number;
  problemResults: ProblemResult[];
  lastSubmissionTimeSeconds?: number;
}

// ProblemResult接口定义
export interface ProblemResult {
  points: number;
  penalty?: number;
  rejectedAttemptCount: number;
  type: 'PRELIMINARY' | 'FINAL';
  bestSubmissionTimeSeconds?: number;
}

// API响应接口
export interface ApiResponse<T> {
  status: 'OK' | 'FAILED';
  comment?: string;
  result?: T;
}

// 缓存配置
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // 缓存时间（秒）
  maxEntries: number; // 最大缓存条目数
  maxSize: number; // 最大缓存大小（字节）
  cacheDir: string; // 缓存目录
}

// API配置
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: {
    requests: number;
    window: number; // 时间窗口（毫秒）
    requestInterval?: number;
    burstLimit?: number;
  };
}

// 题面接口定义
export interface ProblemStatement {
  contestId?: number;
  index: string;
  name: string;
  timeLimit: string;
  memoryLimit: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  samples: Sample[];
  note?: string;
}

// 样例接口定义
export interface Sample {
  input: string;
  output: string;
}

// 题面格式枚举
export enum StatementFormat {
  HTML = 'html',
  MARKDOWN = 'markdown'
}

// 应用配置
export interface AppConfig {
  api: ApiConfig;
  cache: CacheConfig;
  handle?: string; // 用户的Codeforces用户名
}