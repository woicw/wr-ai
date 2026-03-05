import { log } from './logger.js';

/**
 * 检查是否为取消操作的错误
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否为取消错误
 */
export function isCancelError(error) {
  return error.name === 'CancelError' ||
         error.name === 'ExitPromptError' ||
         error.message?.includes('SIGINT') ||
         error.message?.includes('cancel') ||
         error.message?.includes('取消');
}

/**
 * 处理取消错误，如果是取消操作则退出，否则重新抛出
 * @param {Error} error - 错误对象
 * @param {Object} spinner - ora spinner 对象（可选）
 * @throws {Error} 如果不是取消错误，重新抛出原错误
 */
export function handleCancelError(error, spinner) {
  if (isCancelError(error)) {
    spinner?.stop();
    log.info('操作已取消');
    process.exit(0);
  }
  throw error;
}
