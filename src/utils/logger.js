import * as c from 'yoctocolors';

// 日志工具
export const log = {
  info: (msg) => console.log(c.cyan('ℹ'), msg),
  warn: (msg) => console.log(c.yellow('⚠'), msg),
  error: (msg) => console.log(c.red('✖'), msg),
  success: (msg) => console.log(c.green('✔'), msg),
};
