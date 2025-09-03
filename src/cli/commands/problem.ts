import { Command } from 'commander';
import { CodeforcesAPI } from '../../api/codeforces';
import { Problem, StatementFormat } from '../../types/index.js';
import { formatTable, formatJson, formatDetail } from '../../utils/formatter.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 格式化题目信息
 */
function formatProblem(problem: Problem, stats?: any): string {
  const contestInfo = problem.contestId ? `Contest ${problem.contestId}` : problem.problemsetName || 'Problemset';
  const rating = problem.rating ? `Rating: ${problem.rating}` : 'Rating: N/A';
  const points = problem.points ? `Points: ${problem.points}` : 'Points: N/A';
  const solvedCount = stats?.solvedCount ? `Solved: ${stats.solvedCount}` : '';
  
  return `${contestInfo} - ${problem.index}: ${problem.name}\n` +
         `Type: ${problem.type}\n` +
         `${rating}\n` +
         `${points}\n` +
         `${solvedCount}\n` +
         `Tags: ${problem.tags.join(', ')}`;
}

/**
 * 格式化题目列表为表格
 */
function formatProblemTable(problems: Problem[], statistics?: any[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('Contest'.padEnd(10) + 'Index'.padEnd(8) + 'Name'.padEnd(40) + 'Rating'.padEnd(8) + 'Solved'.padEnd(8) + 'Tags');
  console.log('='.repeat(120));
  
  problems.forEach((problem, index) => {
    const contestId = problem.contestId?.toString() || 'PS';
    const name = problem.name.length > 38 ? problem.name.substring(0, 35) + '...' : problem.name;
    const rating = problem.rating?.toString() || 'N/A';
    const stats = statistics?.[index];
    const solved = stats?.solvedCount?.toString() || 'N/A';
    const tags = problem.tags.slice(0, 2).join(', ');
    const tagsDisplay = tags.length > 20 ? tags.substring(0, 17) + '...' : tags;
    
    console.log(
      contestId.padEnd(10) +
      problem.index.padEnd(8) +
      name.padEnd(40) +
      rating.padEnd(8) +
      solved.padEnd(8) +
      tagsDisplay
    );
  });
  
  console.log('='.repeat(120) + '\n');
}

export const problemCommand = new Command('problem')
  .description('题目相关命令')
  .addCommand(
    new Command('list')
      .description('获取题目列表')
      .option('-t, --tags <tags>', '按标签筛选，用逗号分隔')
      .option('-r, --rating <rating>', '按难度筛选 (例: 1200-1400)')
      .option('-l, --limit <number>', '限制返回数量', '20')
      .option('-f, --format <format>', '输出格式 (table|json|detail)', 'table')
      .option('--solved-min <number>', '最少解决人数')
      .option('--solved-max <number>', '最多解决人数')
      .action(async (options) => {
        try {
          console.log('正在获取题目列表...');
          
          const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
          const api = new CodeforcesAPI();
          const result = await api.getProblems(tags);
          
          let { problems, problemStatistics } = result;
          
          // 按难度筛选
          if (options.rating) {
            const ratingRange = options.rating.split('-');
            if (ratingRange.length === 2) {
              const minRating = parseInt(ratingRange[0]);
              const maxRating = parseInt(ratingRange[1]);
              problems = problems.filter(p => 
                p.rating && p.rating >= minRating && p.rating <= maxRating
              );
            } else {
              const exactRating = parseInt(options.rating);
              problems = problems.filter(p => p.rating === exactRating);
            }
          }
          
          // 按解决人数筛选
          if (options.solvedMin || options.solvedMax) {
            const filteredIndices: number[] = [];
            problemStatistics.forEach((stat, index) => {
              const solvedCount = stat.solvedCount;
              let include = true;
              
              if (options.solvedMin && solvedCount < parseInt(options.solvedMin)) {
                include = false;
              }
              if (options.solvedMax && solvedCount > parseInt(options.solvedMax)) {
                include = false;
              }
              
              if (include) {
                filteredIndices.push(index);
              }
            });
            
            problems = problems.filter((_, index) => filteredIndices.includes(index));
            problemStatistics = problemStatistics.filter((_, index) => filteredIndices.includes(index));
          }
          
          // 限制数量
          const limit = parseInt(options.limit);
          if (limit > 0) {
            problems = problems.slice(0, limit);
            problemStatistics = problemStatistics.slice(0, limit);
          }
          
          if (problems.length === 0) {
            console.log('没有找到符合条件的题目');
            return;
          }
          
          // 根据格式输出
          switch (options.format) {
            case 'json':
              console.log(JSON.stringify({ problems, problemStatistics }, null, 2));
              break;
            case 'detail':
              problems.forEach((problem, index) => {
                console.log(`\n--- Problem ${index + 1} ---`);
                console.log(formatProblem(problem, problemStatistics[index]));
              });
              break;
            case 'table':
            default:
              formatProblemTable(problems, problemStatistics);
              break;
          }
          
          console.log(`共找到 ${problems.length} 道题目`);
        } catch (error: any) {
          console.error('获取题目列表失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('search')
      .description('搜索题目')
      .argument('<keyword>', '搜索关键词')
      .option('-l, --limit <number>', '限制返回数量', '10')
      .option('-f, --format <format>', '输出格式 (table|json|detail)', 'table')
      .action(async (keyword, options) => {
        try {
          console.log(`正在搜索包含 "${keyword}" 的题目...`);
          
          const api = new CodeforcesAPI();
          const result = await api.getProblems();
          let { problems, problemStatistics } = result;
          
          // 搜索题目名称
          const searchKeyword = keyword.toLowerCase();
          const matchedIndices: number[] = [];
          
          problems.forEach((problem, index) => {
            if (problem.name.toLowerCase().includes(searchKeyword) ||
                problem.tags.some(tag => tag.toLowerCase().includes(searchKeyword))) {
              matchedIndices.push(index);
            }
          });
          
          problems = problems.filter((_, index) => matchedIndices.includes(index));
          problemStatistics = problemStatistics.filter((_, index) => matchedIndices.includes(index));
          
          // 限制数量
          const limit = parseInt(options.limit);
          if (limit > 0) {
            problems = problems.slice(0, limit);
            problemStatistics = problemStatistics.slice(0, limit);
          }
          
          if (problems.length === 0) {
            console.log(`没有找到包含 "${keyword}" 的题目`);
            return;
          }
          
          // 根据格式输出
          switch (options.format) {
            case 'json':
              console.log(JSON.stringify({ problems, problemStatistics }, null, 2));
              break;
            case 'detail':
              problems.forEach((problem, index) => {
                console.log(`\n--- Problem ${index + 1} ---`);
                console.log(formatProblem(problem, problemStatistics[index]));
              });
              break;
            case 'table':
            default:
              formatProblemTable(problems, problemStatistics);
              break;
          }
          
          console.log(`共找到 ${problems.length} 道相关题目`);
        } catch (error: any) {
          console.error('搜索题目失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('tags')
      .description('获取所有可用的题目标签')
      .option('-c, --count', '显示每个标签的题目数量')
      .action(async (options) => {
        try {
          console.log('正在获取题目标签...');
          
          const api = new CodeforcesAPI();
          const result = await api.getProblems();
          const { problems } = result;
          
          // 统计标签
          const tagCount = new Map<string, number>();
          
          problems.forEach(problem => {
            problem.tags.forEach(tag => {
              tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
            });
          });
          
          // 按标签名称排序
          const sortedTags = Array.from(tagCount.entries()).sort((a, b) => a[0].localeCompare(b[0]));
          
          console.log('\n可用的题目标签:');
          console.log('='.repeat(60));
          
          if (options.count) {
            console.log('Tag'.padEnd(40) + 'Count');
            console.log('='.repeat(60));
            sortedTags.forEach(([tag, count]) => {
              console.log(tag.padEnd(40) + count.toString());
            });
          } else {
            const tags = sortedTags.map(([tag]) => tag);
            for (let i = 0; i < tags.length; i += 3) {
              const row = tags.slice(i, i + 3);
              console.log(row.map(tag => tag.padEnd(20)).join(''));
            }
          }
          
          console.log('='.repeat(60));
          console.log(`\n共 ${sortedTags.length} 个标签`);
        } catch (error: any) {
          console.error('获取题目标签失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('statement')
      .description('获取题目题面')
      .argument('<contestId>', '比赛ID')
      .argument('<index>', '题目索引 (A, B, C, ...)')
      .option('-f, --format <format>', '输出格式 (html|markdown)', 'markdown')
      .option('-o, --output <file>', '保存到文件')
      .option('--save', '保存到文件（与--output-dir配合使用）')
      .option('--output-dir <dir>', '输出目录')
      .option('--no-cache', '不使用缓存')
      .action(async (contestId, index, options) => {
        try {
          const contestIdNum = parseInt(contestId);
          if (isNaN(contestIdNum)) {
            console.error('比赛ID必须是数字');
            process.exit(1);
          }

          console.log(`正在获取题目 ${contestId}${index} 的题面...`);
          
          const api = new CodeforcesAPI();
          const useCache = options.cache !== false; // --no-cache 参数会将options.cache设为false
          const statement = await api.getProblemStatement(contestIdNum, index.toUpperCase(), useCache);
          
          const format = options.format.toLowerCase() === 'html' ? StatementFormat.HTML : StatementFormat.MARKDOWN;
          const formattedStatement = api.formatProblemStatement(statement, format);
          
          // 处理文件保存逻辑
          let shouldSave = false;
          let outputPath = '';
          
          if (options.output) {
            // 使用 -o/--output 参数
            shouldSave = true;
            outputPath = path.resolve(options.output);
          } else if (options.save && options.outputDir) {
            // 使用 --save 和 --output-dir 参数
            shouldSave = true;
            const fileName = `${contestId}${index.toUpperCase()}.${format === StatementFormat.HTML ? 'html' : 'md'}`;
            outputPath = path.resolve(options.outputDir, fileName);
          } else if (options.save) {
            // 只有 --save 参数，使用默认目录
            shouldSave = true;
            const fileName = `${contestId}${index.toUpperCase()}.${format === StatementFormat.HTML ? 'html' : 'md'}`;
            outputPath = path.resolve('statements', fileName);
          }
          
          if (shouldSave) {
            // 保存到文件
            const dir = path.dirname(outputPath);
            
            // 确保目录存在
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
              console.log(`创建目录: ${dir}`);
            }
            
            fs.writeFileSync(outputPath, formattedStatement, 'utf-8');
            console.log(`题面已保存到: ${outputPath}`);
          } else {
            // 输出到控制台
            console.log('\n' + '='.repeat(80));
            console.log(formattedStatement);
            console.log('='.repeat(80));
          }
        } catch (error: any) {
          console.error('获取题面失败:', error.message);
          process.exit(1);
        }
      })
  );