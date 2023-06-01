export const color = {
  error: (message: string) => `\x1B[31m${message}\x1B[0m`,
  info: (message: string) => `\x1B[34m${message}\x1B[0m`,
  warn: (message: string) => `\x1B[33m${message}\x1B[0m`,
  fade: (message: string) => `\x1B[90m${message}\x1B[0m`,
};
