import express from 'express';
import cors from 'cors';
import { CodeforcesAPI } from '../api/codeforces';
import { getConfig } from '../config/index.js';
import { Contest, Problem, User, Submission } from '../types/index.js';

const app = express();
const config = getConfig();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 错误处理中间件
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由

// 获取比赛列表
app.get('/api/contests', asyncHandler(async (req: any, res: any) => {
  const { gym } = req.query;
  const api = new CodeforcesAPI();
  const contests = await api.getContests(gym === 'true');
  res.json({ success: true, data: contests });
}));

// 获取比赛排名
app.get('/api/contests/:contestId/standings', asyncHandler(async (req: any, res: any) => {
  const { contestId } = req.params;
  const { from, count, handles, room, showUnofficial } = req.query;
  
  const api = new CodeforcesAPI();
   const standings = await api.getContestStandings(
     parseInt(contestId),
     from ? parseInt(from) : undefined,
     count ? parseInt(count) : undefined,
     handles ? handles.split(',') : undefined
   );
  
  res.json({ success: true, data: standings });
}));

// 获取比赛题目
app.get('/api/contests/:contestId/problems', asyncHandler(async (req: any, res: any) => {
  const { contestId } = req.params;
  const api = new CodeforcesAPI();
   const problems = await api.getContestProblems(parseInt(contestId));
   res.json({ success: true, data: problems });
}));

// 获取题目列表
app.get('/api/problems', asyncHandler(async (req: any, res: any) => {
  const { tags, limit } = req.query;
  const api = new CodeforcesAPI();
  const { problems } = await api.getProblems(
    tags ? tags.split(',') : undefined
  );
  res.json({ success: true, data: problems });
}));

// 搜索题目
app.get('/api/problems/search', asyncHandler(async (req: any, res: any) => {
  const { keyword, tags, rating, limit } = req.query;
  
  if (!keyword) {
    return res.status(400).json({ success: false, error: '缺少搜索关键词' });
  }
  
  const api = new CodeforcesAPI();
  const { problems } = await api.getProblems();
  
  // 在内存中搜索题目
  let filteredProblems = problems.filter(p => 
    p.name.toLowerCase().includes(keyword.toLowerCase()) ||
    p.tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))
  );
  
  if (tags) {
    const searchTags = tags.split(',').map((t: string) => t.trim().toLowerCase());
    filteredProblems = filteredProblems.filter(p => 
      searchTags.some(tag => p.tags.some(pTag => pTag.toLowerCase().includes(tag)))
    );
  }
  
  if (rating) {
    filteredProblems = filteredProblems.filter(p => p.rating === parseInt(rating));
  }
  
  if (limit) {
    filteredProblems = filteredProblems.slice(0, parseInt(limit));
  }
  
  res.json({ success: true, data: problems });
}));

// 获取题目标签
app.get('/api/problems/tags', asyncHandler(async (req: any, res: any) => {
  const { withCount } = req.query;
  const api = new CodeforcesAPI();
  const { problems } = await api.getProblems();
  const tagSet = new Set<string>();
  problems.forEach(p => p.tags.forEach(tag => tagSet.add(tag)));
  const tags = Array.from(tagSet).sort();
  res.json({ success: true, data: tags });
}));

// 获取用户信息
app.get('/api/users/:handles', asyncHandler(async (req: any, res: any) => {
  const { handles } = req.params;
  const userHandles = handles.split(',');
  const api = new CodeforcesAPI();
  const users = await api.getUserInfo(userHandles);
  res.json({ success: true, data: users });
}));

// 获取用户提交记录
app.get('/api/users/:handle/submissions', asyncHandler(async (req: any, res: any) => {
  const { handle } = req.params;
  const { from, count } = req.query;
  
  const api = new CodeforcesAPI();
  const submissions = await api.getUserSubmissions(
    handle,
    from ? parseInt(from) : undefined,
    count ? parseInt(count) : undefined
  );
  
  res.json({ success: true, data: submissions });
}));

// 获取配置信息
app.get('/api/config', (req, res) => {
  const publicConfig = {
    api: {
      baseUrl: config.api.baseUrl,
      timeout: config.api.timeout
    },
    cache: {
      enabled: config.cache.enabled,
      ttl: config.cache.ttl
    }
  };
  res.json({ success: true, data: publicConfig });
});

// 缓存统计
app.get('/api/cache/stats', asyncHandler(async (req: any, res: any) => {
  const { cacheManager } = await import('../utils/cache.js');
  const stats = await cacheManager.getStats();
  res.json({ success: true, data: stats });
}));

// 清理缓存
app.delete('/api/cache', asyncHandler(async (req: any, res: any) => {
  const { cacheManager } = await import('../utils/cache.js');
  await cacheManager.clear();
  res.json({ success: true, message: '缓存已清理' });
}));

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 错误处理
app.use((error: any, req: any, res: any, next: any) => {
  console.error('API Error:', error);
  
  if (error.response?.status === 400) {
    return res.status(400).json({ 
      success: false, 
      error: 'Codeforces API 请求参数错误',
      details: error.response.data
    });
  }
  
  if (error.response?.status === 403) {
    return res.status(403).json({ 
      success: false, 
      error: 'Codeforces API 访问被拒绝',
      details: error.response.data
    });
  }
  
  if (error.response?.status >= 500) {
    return res.status(502).json({ 
      success: false, 
      error: 'Codeforces API 服务器错误',
      details: error.response.data
    });
  }
  
  res.status(500).json({ 
    success: false, 
    error: '内部服务器错误',
    message: error.message
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Codeforces API 服务器已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API 文档: http://localhost:${PORT}/api`);
});

export default app;