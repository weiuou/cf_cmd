import { Contest, Problem, User, Submission } from '../types/index.js';

/**
 * 格式化为表格输出
 */
export function formatTable(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  const keys = headers || Object.keys(data[0]);
  const rows = data.map(item => keys.map(key => String(item[key] || '')));
  
  // 计算每列的最大宽度
  const colWidths = keys.map((key, i) => 
    Math.max(key.length, ...rows.map(row => row[i].length))
  );

  // 创建分隔线
  const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  
  // 格式化行
  const formatRow = (cells: string[]) => 
    '|' + cells.map((cell, i) => ` ${cell.padEnd(colWidths[i])} `).join('|') + '|';

  const result = [
    separator,
    formatRow(keys),
    separator,
    ...rows.map(formatRow),
    separator
  ];

  return result.join('\n');
}

/**
 * 格式化为JSON输出
 */
export function formatJson(data: any, pretty: boolean = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

/**
 * 格式化为详细信息输出
 */
export function formatDetail(data: any): string {
  if (Array.isArray(data)) {
    return data.map((item, index) => {
      const details = Object.entries(item)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');
      return `Item ${index + 1}:\n${details}`;
    }).join('\n\n');
  } else {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
}

/**
 * 格式化比赛信息
 */
export function formatContest(contest: Contest): string {
  return [
    `ID: ${contest.id}`,
    `Name: ${contest.name}`,
    `Type: ${contest.type}`,
    `Phase: ${contest.phase}`,
    `Duration: ${Math.floor(contest.durationSeconds / 3600)}h ${Math.floor((contest.durationSeconds % 3600) / 60)}m`,
    `Start Time: ${new Date(contest.startTimeSeconds * 1000).toLocaleString()}`,
    contest.description ? `Description: ${contest.description}` : ''
  ].filter(Boolean).join('\n');
}

/**
 * 格式化题目信息
 */
export function formatProblem(problem: Problem): string {
  return [
    `${problem.contestId}${problem.index}: ${problem.name}`,
    `Type: ${problem.type}`,
    `Points: ${problem.points || 'N/A'}`,
    `Rating: ${problem.rating || 'N/A'}`,
    `Tags: ${problem.tags.join(', ')}`
  ].join('\n');
}

/**
 * 格式化用户信息
 */
export function formatUser(user: User): string {
  return [
    `Handle: ${user.handle}`,
    `Email: ${user.email || 'N/A'}`,
    `VK ID: ${user.vkId || 'N/A'}`,
    `Open ID: ${user.openId || 'N/A'}`,
    `First Name: ${user.firstName || 'N/A'}`,
    `Last Name: ${user.lastName || 'N/A'}`,
    `Country: ${user.country || 'N/A'}`,
    `City: ${user.city || 'N/A'}`,
    `Organization: ${user.organization || 'N/A'}`,
    `Contribution: ${user.contribution}`,
    `Rank: ${user.rank}`,
    `Rating: ${user.rating || 'N/A'}`,
    `Max Rank: ${user.maxRank}`,
    `Max Rating: ${user.maxRating || 'N/A'}`,
    `Last Online: ${new Date(user.lastOnlineTimeSeconds * 1000).toLocaleString()}`,
    `Registration: ${new Date(user.registrationTimeSeconds * 1000).toLocaleString()}`,
    `Friend Count: ${user.friendOfCount}`
  ].join('\n');
}

/**
 * 格式化提交信息
 */
export function formatSubmission(submission: Submission): string {
  return [
    `ID: ${submission.id}`,
    `Contest ID: ${submission.contestId || 'N/A'}`,
    `Problem: ${submission.problem.contestId}${submission.problem.index} - ${submission.problem.name}`,
    `Author: ${submission.author.members.map(m => m.handle).join(', ')}`,
    `Programming Language: ${submission.programmingLanguage}`,
    `Verdict: ${submission.verdict || 'N/A'}`,
    `Test Set: ${submission.testset}`,
    `Passed Tests: ${submission.passedTestCount}`,
    `Time: ${submission.timeConsumedMillis}ms`,
    `Memory: ${submission.memoryConsumedBytes} bytes`,
    `Points: ${submission.points || 'N/A'}`,
    `Creation Time: ${new Date(submission.creationTimeSeconds * 1000).toLocaleString()}`
  ].join('\n');
}