#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig } from '../config/index.js';
import { contestCommand } from './commands/contest.js';
import { problemCommand } from './commands/problem.js';
import { userCommand } from './commands/user.js';
import { configCommand } from './commands/config.js';

const program = new Command();
const config = getConfig();

program
  .name('cf-tool')
  .description('Codeforces API 工具')
  .version('1.0.0');

// 添加子命令
program.addCommand(contestCommand);
program.addCommand(problemCommand);
program.addCommand(userCommand);
program.addCommand(configCommand);

program.parse();