import { Command } from 'commander';
import { CodeforcesAPI } from '../../api/codeforces.js';
import { Contest, StatementFormat } from '../../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 格式化竞赛信息
 */
function formatContest(contest: Contest): string {
  const startTime = contest.startTimeSeconds 
    ? new Date(contest.startTimeSeconds * 1000).toLocaleString()
    : 'TBD';
  
  const duration = contest.durationSeconds 
    ? `${Math.floor(contest.durationSeconds / 3600)}h ${Math.floor((contest.durationSeconds % 3600) / 60)}m`
    : 'Unknown';

  return `ID: ${contest.id}
` +
         `Name: ${contest.name}
` +
         `Type: ${contest.type}
` +
         `Phase: ${contest.phase}
` +
         `Start Time: ${startTime}
` +
         `Duration: ${duration}
` +
         `Frozen: ${contest.frozen ? 'Yes' : 'No'}`;
}

/**
 * 格式化竞赛列表为表格
 */
function formatContestTable(contests: Contest[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('ID'.padEnd(8) + 'Name'.padEnd(50) + 'Type'.padEnd(8) + 'Phase'.padEnd(20) + 'Start Time'.padEnd(20) + 'Duration');
  console.log('='.repeat(120));
  
  contests.forEach(contest => {
    const startTime = contest.startTimeSeconds 
      ? new Date(contest.startTimeSeconds * 1000).toLocaleDateString()
      : 'TBD';
    
    const duration = contest.durationSeconds 
      ? `${Math.floor(contest.durationSeconds / 3600)}h${Math.floor((contest.durationSeconds % 3600) / 60)}m`
      : 'Unknown';

    const name = contest.name.length > 48 ? contest.name.substring(0, 45) + '...' : contest.name;
    
    console.log(
      contest.id.toString().padEnd(8) +
      name.padEnd(50) +
      contest.type.padEnd(8) +
      contest.phase.padEnd(20) +
      startTime.padEnd(20) +
      duration
    );
  });
  
  console.log('='.repeat(120) + '\n');
}

export const contestCommand = new Command('contest')
  .description('竞赛相关命令')
  .addCommand(
    new Command('list')
      .description('获取竞赛列表')
      .option('-g, --gym', '包含训练赛')
      .option('-l, --limit <number>', '限制返回数量', '20')
      .option('-f, --format <format>', '输出格式 (table|json|detail)', 'table')
      .option('--phase <phase>', '按阶段筛选 (BEFORE|CODING|PENDING_SYSTEM_TEST|SYSTEM_TEST|FINISHED)')
      .action(async (options) => {
        try {
          console.log('正在获取竞赛列表...');
          
          const api = new CodeforcesAPI();
          const contests = await api.getContests(options.gym);
          
          // 按阶段筛选
          let filteredContests = contests;
          if (options.phase) {
            filteredContests = contests.filter(c => c.phase === options.phase.toUpperCase());
          }
          
          // 限制数量
          const limit = parseInt(options.limit);
          if (limit > 0) {
            filteredContests = filteredContests.slice(0, limit);
          }
          
          if (filteredContests.length === 0) {
            console.log('没有找到符合条件的竞赛');
            return;
          }
          
          // 根据格式输出
          switch (options.format) {
            case 'json':
              console.log(JSON.stringify(filteredContests, null, 2));
              break;
            case 'detail':
              filteredContests.forEach((contest, index) => {
                console.log(`\n--- Contest ${index + 1} ---`);
                console.log(formatContest(contest));
              });
              break;
            case 'table':
            default:
              formatContestTable(filteredContests);
              break;
          }
          
          console.log(`共找到 ${filteredContests.length} 个竞赛`);
        } catch (error: any) {
          console.error('获取竞赛列表失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('standings')
      .description('获取竞赛排名')
      .argument('<contestId>', '竞赛ID')
      .option('-f, --from <number>', '起始排名', '1')
      .option('-c, --count <number>', '返回数量', '10')
      .option('-u, --users <users>', '指定用户名，用逗号分隔')
      .option('--format <format>', '输出格式 (table|json)', 'table')
      .action(async (contestId, options) => {
        try {
          console.log(`正在获取竞赛 ${contestId} 的排名...`);
          
          const from = parseInt(options.from);
          const count = parseInt(options.count);
          const handles = options.users ? options.users.split(',').map((u: string) => u.trim()) : undefined;
          
          const api = new CodeforcesAPI();
          const standings = await api.getContestStandings(
            parseInt(contestId),
            from,
            count,
            handles
          );
          
          if (options.format === 'json') {
            console.log(JSON.stringify(standings, null, 2));
          } else {
            console.log(`\n竞赛: ${standings.contest.name}`);
            console.log(`阶段: ${standings.contest.phase}`);
            console.log(`题目数量: ${standings.problems.length}\n`);
            
            // 显示排名表格
            console.log('='.repeat(80));
            console.log('Rank'.padEnd(6) + 'Handle'.padEnd(20) + 'Points'.padEnd(10) + 'Penalty'.padEnd(10) + 'Hacks');
            console.log('='.repeat(80));
            
            standings.rows.forEach(row => {
              const handle = row.party.members[0]?.handle || 'Unknown';
              console.log(
                row.rank.toString().padEnd(6) +
                handle.padEnd(20) +
                row.points.toString().padEnd(10) +
                row.penalty.toString().padEnd(10) +
                `+${row.successfulHackCount}/-${row.unsuccessfulHackCount}`
              );
            });
            
            console.log('='.repeat(80));
          }
        } catch (error: any) {
          console.error('获取竞赛排名失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('problems')
      .description('获取竞赛题目列表')
      .argument('<contestId>', '竞赛ID')
      .option('--format <format>', '输出格式 (table|json)', 'table')
      .action(async (contestId, options) => {
        try {
          console.log(`正在获取竞赛 ${contestId} 的题目列表...`);
          
          const api = new CodeforcesAPI();
          const problems = await api.getContestProblems(parseInt(contestId));
          
          if (options.format === 'json') {
            console.log(JSON.stringify(problems, null, 2));
          } else {
            console.log('\n' + '='.repeat(100));
            console.log('Index'.padEnd(8) + 'Name'.padEnd(50) + 'Points'.padEnd(10) + 'Tags');
            console.log('='.repeat(100));
            
            problems.forEach(problem => {
              const name = problem.name.length > 48 ? problem.name.substring(0, 45) + '...' : problem.name;
              const points = problem.points?.toString() || 'N/A';
              const tags = problem.tags.slice(0, 3).join(', ');
              
              console.log(
                problem.index.padEnd(8) +
                name.padEnd(50) +
                points.padEnd(10) +
                tags
              );
            });
            
            console.log('='.repeat(100));
            console.log(`\n共 ${problems.length} 道题目`);
          }
        } catch (error: any) {
          console.error('获取竞赛题目失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('statements')
      .description('批量下载竞赛所有题面到文件夹')
      .argument('<contestId>', '竞赛ID')
      .option('-o, --output <dir>', '输出目录', './statements')
      .option('-f, --format <format>', '输出格式 (html|markdown)', 'markdown')
      .action(async (contestId, options) => {
        try {
          const contestIdNum = parseInt(contestId);
          if (isNaN(contestIdNum)) {
            console.error('比赛ID必须是数字');
            process.exit(1);
          }

          console.log(`正在获取竞赛 ${contestId} 的题目列表...`);
          
          const api = new CodeforcesAPI();
          const problems = await api.getContestProblems(contestIdNum);
          
          if (problems.length === 0) {
            console.log('该竞赛没有题目');
            return;
          }
          
          // 创建输出目录
          const outputDir = path.resolve(options.output, `contest-${contestId}`);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          console.log(`开始下载 ${problems.length} 道题目的题面...`);
          console.log(`输出目录: ${outputDir}`);
          
          const format = options.format.toLowerCase() === 'html' ? StatementFormat.HTML : StatementFormat.MARKDOWN;
          const extension = format === StatementFormat.HTML ? '.html' : '.md';
          
          let successCount = 0;
          let failCount = 0;
          
          for (const problem of problems) {
            try {
              console.log(`正在下载题目 ${problem.index}: ${problem.name}...`);
              
              const statement = await api.getProblemStatement(contestIdNum, problem.index);
              const formattedStatement = api.formatProblemStatement(statement, format);
              
              const filename = `${problem.index}-${problem.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}${extension}`;
              const filepath = path.join(outputDir, filename);
              
              fs.writeFileSync(filepath, formattedStatement, 'utf-8');
              console.log(`✓ 已保存: ${filename}`);
              successCount++;
              
              // 添加延迟避免请求过于频繁
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error: any) {
              console.error(`✗ 下载题目 ${problem.index} 失败: ${error.message}`);
              failCount++;
            }
          }
          
          console.log(`\n下载完成!`);
          console.log(`成功: ${successCount} 道题目`);
          console.log(`失败: ${failCount} 道题目`);
          console.log(`文件保存在: ${outputDir}`);
        } catch (error: any) {
          console.error('批量下载题面失败:', error.message);
          process.exit(1);
        }
      })
  );