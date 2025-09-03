const { execFile } = require('child_process');
const path = require('path');

function b64(s = '') {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

/**
 * 计算 a_bogus 签名
 * @param {string} query    原始 querystring（未编码）
 * @param {string} [userAgent] 可选 UA；若不传可在 a_bogus.js 内使用默认或 .env
 * @returns {Promise<string>} a_bogus
 */
function sign(query, userAgent) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'a_bogus.js');

    // 统一用 base64 传参（与 a_bogus.js 保持一致）
    const args = [b64(query ?? '')];
    if (userAgent) args.push(b64(userAgent));

    const options = {
      timeout: 15_000,                 // 稍微放宽，避免偶发超时
      maxBuffer: 10 * 1024 * 1024,     // 10MB
      encoding: 'utf8',
      windowsHide: true
    };

    const child = execFile(
      process.execPath,                // 比 'node' 更健壮
      [scriptPath, ...args],
      options,
      (error, stdout = '', stderr = '') => {
        if (error) {
          if (error.killed && error.signal) {
            return reject(new Error(`签名计算超时（${options.timeout}ms），进程已由信号 ${error.signal} 终止`));
          }
          if (error.code === 'ENOENT') {
            return reject(new Error(`无法找到可执行文件或脚本：${scriptPath}`));
          }
          if (typeof error.code === 'number') {
            return reject(new Error(`签名脚本退出码 ${error.code}${stderr ? `：${stderr.trim()}` : ''}`));
          }
          return reject(new Error(`签名计算出错：${error.message}`));
        }

        if (stderr && stderr.trim()) {
          // 仅警告，不直接视为失败
          console.warn('[sign] 子进程警告：', stderr.trim());
        }

        const result = stdout.trim();
        if (!result) {
          return reject(new Error('签名返回空结果：可能 a_bogus.js 失效或参数不匹配'));
        }

        resolve(result);
      }
    );

    // 启动期错误（权限/资源等）
    child.on('error', (err) => {
      reject(new Error(`无法启动 node 子进程：${err.message}`));
    });
  });
}

module.exports = { sign };
