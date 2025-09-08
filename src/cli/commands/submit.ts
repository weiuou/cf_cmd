import { Command } from 'commander';
import { codeforcesAPI } from '../../api/codeforces';
import { SubmitCodeParams } from '../../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

// 语言ID映射表
const LANGUAGE_MAP: Record<string, number> = {
  'cpp': 54, // GNU G++17 7.3.0
  'cpp14': 50, // GNU G++14 6.4.0
  'cpp17': 54, // GNU G++17 7.3.0
  'cpp20': 73, // GNU G++20 11.2.0
  'c': 43, // GNU GCC C11 5.1.0
  'cs': 55, // Mono C# 5.2.3
  'java': 36, // Java 1.8.0_241
  'java11': 60, // Java 11.0.6
  'kotlin': 48, // Kotlin 1.3.70
  'python': 31, // Python 3.8.10
  'python2': 6, // Python 2.7.18
  'python3': 31, // Python 3.8.10
  'pypy': 40, // PyPy 2.7.13
  'pypy3': 41, // PyPy 3.6.9
  'ruby': 67, // Ruby 3.0.0
  'rust': 49, // Rust 1.57.0
  'scala': 20, // Scala 2.12.8
  'js': 55, // Node.js 12.16.3
  'javascript': 55, // Node.js 12.16.3
  'go': 32, // Go 1.19.5
  'php': 68, // PHP 8.1.7
};

// 检测文件语言
function detectLanguage(filePath: string): number | undefined {
  const ext = path.extname(filePath).toLowerCase().substring(1);
  
  // 直接匹配扩展名
  if (LANGUAGE_MAP[ext]) {
    return LANGUAGE_MAP[ext];
  }
  
  // 特殊处理一些扩展名
  switch (ext) {
    case 'cc':
    case 'cxx':
    case 'hpp':
      return LANGUAGE_MAP['cpp17'];
    case 'py':
      return LANGUAGE_MAP['python3'];
    case 'js':
      return LANGUAGE_MAP['javascript'];
    default:
      return undefined;
  }
}

export const submitCommand = new Command('submit')
  .description('提交代码到Codeforces')
  .argument('<problem>', '题目ID，格式为[contestId][problemIndex]，例如：1000A 或 1000/A')
  .argument('<file>', '代码文件路径')
  .option('-l, --language <language>', '编程语言ID或简称，例如：cpp, python, java等')
  .option('-g, --group <groupId>', '小组ID（如果是小组比赛）')
  .action(async (problem, file, options) => {
    try {
      // 解析题目ID
      let contestId: number;
      let problemIndex: string;
      
      // 处理格式：1000A 或 1000/A
      const match = problem.match(/^(\d+)([A-Za-z][0-9]*)$/) || problem.match(/^(\d+)\/?([A-Za-z][0-9]*)$/);
      
      if (!match) {
        console.error('题目ID格式不正确，应为[contestId][problemIndex]，例如：1000A 或 1000/A');
        process.exit(1);
      }
      
      contestId = parseInt(match[1]);
      problemIndex = match[2];
      
      // 检查文件是否存在
      if (!fs.existsSync(file)) {
        console.error(`文件不存在: ${file}`);
        process.exit(1);
      }
      
      // 读取文件内容
      const source = fs.readFileSync(file, 'utf-8');
      
      // 确定编程语言
      let programTypeId: number;
      
      if (options.language) {
        // 尝试直接解析为数字
        if (/^\d+$/.test(options.language)) {
          programTypeId = parseInt(options.language);
        } else if (LANGUAGE_MAP[options.language.toLowerCase()]) {
          programTypeId = LANGUAGE_MAP[options.language.toLowerCase()];
        } else {
          console.error(`不支持的语言: ${options.language}`);
          console.log('支持的语言简称:', Object.keys(LANGUAGE_MAP).join(', '));
          process.exit(1);
        }
      } else {
        // 自动检测语言
        const detectedId = detectLanguage(file);
        if (!detectedId) {
          console.error('无法自动检测文件语言，请使用 --language 选项指定语言');
          console.log('支持的语言简称:', Object.keys(LANGUAGE_MAP).join(', '));
          process.exit(1);
        }
        programTypeId = detectedId;
      }
      
      console.log(`正在提交题目 ${contestId}${problemIndex}...`);
      
      const params: SubmitCodeParams = {
        contestId,
        problemIndex,
        programTypeId,
        source,
      };
      
      // 如果有小组ID
      if (options.group) {
        params.groupId = options.group;
      }
      
      const result = await codeforcesAPI.submitCode(params);
      
      if (result.success) {
        console.log(`提交成功！`);
        if (result.submissionId) {
          console.log(`提交ID: ${result.submissionId}`);
          console.log(`查看结果: https://codeforces.com/contest/${contestId}/submission/${result.submissionId}`);
        } else {
          console.log('提交已接受，但未获取到提交ID');
        }
      } else {
        console.error(`提交失败: ${result.error}`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error('提交过程中发生错误:', error.message);
      process.exit(1);
    }
  });