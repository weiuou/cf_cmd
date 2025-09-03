import { Command } from 'commander';
import { codeforcesAPI } from '../../api/codeforces';
import { User, Submission } from '../../types/index.js';

/**
 * 格式化用户信息
 */
function formatUser(user: User): string {
  const rating = user.rating ? `${user.rating} (${user.rank || 'Unrated'})` : 'Unrated';
  const maxRating = user.maxRating ? `${user.maxRating} (${user.maxRank || 'Unknown'})` : 'N/A';
  const registrationDate = new Date(user.registrationTimeSeconds * 1000).toLocaleDateString();
  const lastOnline = new Date(user.lastOnlineTimeSeconds * 1000).toLocaleDateString();
  
  return `Handle: ${user.handle}\n` +
         `Name: ${user.firstName || ''} ${user.lastName || ''}\n` +
         `Country: ${user.country || 'N/A'}\n` +
         `City: ${user.city || 'N/A'}\n` +
         `Organization: ${user.organization || 'N/A'}\n` +
         `Current Rating: ${rating}\n` +
         `Max Rating: ${maxRating}\n` +
         `Contribution: ${user.contribution}\n` +
         `Friends: ${user.friendOfCount}\n` +
         `Registration: ${registrationDate}\n` +
         `Last Online: ${lastOnline}`;
}

/**
 * 格式化用户列表为表格
 */
function formatUserTable(users: User[]): void {
  console.log('\n' + '='.repeat(100));
  console.log('Handle'.padEnd(20) + 'Rating'.padEnd(15) + 'Max Rating'.padEnd(15) + 'Country'.padEnd(15) + 'Contribution');
  console.log('='.repeat(100));
  
  users.forEach(user => {
    const rating = user.rating ? `${user.rating} (${user.rank || 'Unrated'})` : 'Unrated';
    const maxRating = user.maxRating ? `${user.maxRating} (${user.maxRank || 'Unknown'})` : 'N/A';
    const country = user.country || 'N/A';
    
    console.log(
      user.handle.padEnd(20) +
      rating.padEnd(15) +
      maxRating.padEnd(15) +
      country.padEnd(15) +
      user.contribution.toString()
    );
  });
  
  console.log('='.repeat(100) + '\n');
}

/**
 * 格式化提交记录为表格
 */
function formatSubmissionTable(submissions: Submission[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('ID'.padEnd(12) + 'Problem'.padEnd(25) + 'Language'.padEnd(15) + 'Verdict'.padEnd(20) + 'Time'.padEnd(10) + 'Memory');
  console.log('='.repeat(120));
  
  submissions.forEach(submission => {
    const problemName = `${submission.problem.index}. ${submission.problem.name}`;
    const problem = problemName.length > 23 ? problemName.substring(0, 20) + '...' : problemName;
    const language = submission.programmingLanguage.length > 13 ? 
      submission.programmingLanguage.substring(0, 10) + '...' : submission.programmingLanguage;
    const verdict = submission.verdict || 'TESTING';
    const time = `${submission.timeConsumedMillis}ms`;
    const memory = `${Math.round(submission.memoryConsumedBytes / 1024)}KB`;
    
    console.log(
      submission.id.toString().padEnd(12) +
      problem.padEnd(25) +
      language.padEnd(15) +
      verdict.padEnd(20) +
      time.padEnd(10) +
      memory
    );
  });
  
  console.log('='.repeat(120) + '\n');
}

export const userCommand = new Command('user')
  .description('用户相关命令')
  .addCommand(
    new Command('info')
      .description('获取用户信息')
      .argument('<handles>', '用户名，多个用户用逗号分隔')
      .option('-f, --format <format>', '输出格式 (table|json|detail)', 'detail')
      .action(async (handles, options) => {
        try {
          const userHandles = handles.split(',').map((h: string) => h.trim());
          console.log(`正在获取用户信息: ${userHandles.join(', ')}...`);
          
          const users = await codeforcesAPI.getUserInfo(userHandles);
          
          if (users.length === 0) {
            console.log('没有找到用户信息');
            return;
          }
          
          // 根据格式输出
          switch (options.format) {
            case 'json':
              console.log(JSON.stringify(users, null, 2));
              break;
            case 'table':
              formatUserTable(users);
              break;
            case 'detail':
            default:
              users.forEach((user, index) => {
                if (users.length > 1) {
                  console.log(`\n--- User ${index + 1} ---`);
                }
                console.log(formatUser(user));
                if (index < users.length - 1) {
                  console.log('\n' + '-'.repeat(50));
                }
              });
              break;
          }
        } catch (error: any) {
          console.error('获取用户信息失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('submissions')
      .description('获取用户提交记录')
      .argument('<handle>', '用户名')
      .option('-f, --from <number>', '起始位置', '1')
      .option('-c, --count <number>', '返回数量', '10')
      .option('--format <format>', '输出格式 (table|json)', 'table')
      .option('--verdict <verdict>', '按判题结果筛选 (OK|WRONG_ANSWER|TIME_LIMIT_EXCEEDED等)')
      .option('--language <language>', '按编程语言筛选')
      .action(async (handle, options) => {
        try {
          console.log(`正在获取用户 ${handle} 的提交记录...`);
          
          const from = parseInt(options.from);
          const count = parseInt(options.count);
          
          let submissions = await codeforcesAPI.getUserSubmissions(handle, from, count);
          
          // 按判题结果筛选
          if (options.verdict) {
            submissions = submissions.filter(s => s.verdict === options.verdict.toUpperCase());
          }
          
          // 按编程语言筛选
          if (options.language) {
            const language = options.language.toLowerCase();
            submissions = submissions.filter(s => 
              s.programmingLanguage.toLowerCase().includes(language)
            );
          }
          
          if (submissions.length === 0) {
            console.log('没有找到符合条件的提交记录');
            return;
          }
          
          if (options.format === 'json') {
            console.log(JSON.stringify(submissions, null, 2));
          } else {
            formatSubmissionTable(submissions);
          }
          
          console.log(`共找到 ${submissions.length} 条提交记录`);
        } catch (error: any) {
          console.error('获取提交记录失败:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('stats')
      .description('获取用户统计信息')
      .argument('<handle>', '用户名')
      .option('-l, --limit <number>', '分析最近的提交数量', '100')
      .action(async (handle, options) => {
        try {
          console.log(`正在分析用户 ${handle} 的统计信息...`);
          
          const limit = parseInt(options.limit);
          const [userInfo, submissions] = await Promise.all([
            codeforcesAPI.getUserInfo([handle]),
            codeforcesAPI.getUserSubmissions(handle, 1, limit)
          ]);
          
          if (userInfo.length === 0) {
            console.log('用户不存在');
            return;
          }
          
          const user = userInfo[0];
          
          // 统计信息
          const verdictStats = new Map<string, number>();
          const languageStats = new Map<string, number>();
          const problemStats = new Set<string>();
          
          submissions.forEach(submission => {
            // 判题结果统计
            const verdict = submission.verdict || 'TESTING';
            verdictStats.set(verdict, (verdictStats.get(verdict) || 0) + 1);
            
            // 编程语言统计
            languageStats.set(submission.programmingLanguage, 
              (languageStats.get(submission.programmingLanguage) || 0) + 1);
            
            // 解决的题目统计
            if (verdict === 'OK') {
              const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
              problemStats.add(problemKey);
            }
          });
          
          // 输出统计信息
          console.log('\n' + '='.repeat(60));
          console.log(`用户统计信息: ${handle}`);
          console.log('='.repeat(60));
          
          console.log(`\n基本信息:`);
          console.log(`  当前Rating: ${user.rating || 'Unrated'} (${user.rank || 'Unrated'})`);
          console.log(`  最高Rating: ${user.maxRating || 'N/A'} (${user.maxRank || 'N/A'})`);
          console.log(`  贡献值: ${user.contribution}`);
          
          console.log(`\n提交统计 (最近 ${submissions.length} 次提交):`);
          console.log(`  总提交数: ${submissions.length}`);
          console.log(`  解决题目数: ${problemStats.size}`);
          
          console.log(`\n判题结果分布:`);
          Array.from(verdictStats.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([verdict, count]) => {
              const percentage = ((count / submissions.length) * 100).toFixed(1);
              console.log(`  ${verdict}: ${count} (${percentage}%)`);
            });
          
          console.log(`\n编程语言分布:`);
          Array.from(languageStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([language, count]) => {
              const percentage = ((count / submissions.length) * 100).toFixed(1);
              console.log(`  ${language}: ${count} (${percentage}%)`);
            });
          
          console.log('='.repeat(60));
        } catch (error: any) {
          console.error('获取用户统计失败:', error.message);
          process.exit(1);
        }
      })
  );