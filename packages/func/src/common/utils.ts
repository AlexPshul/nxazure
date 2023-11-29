export const color = {
  error: (message: string) => `\x1B[31m${message}\x1B[0m`, // Red
  warn: (message: string) => `\x1B[33m${message}\x1B[0m`, // Yellow
  info: (message: string) => `\x1B[94m${message}\x1B[0m`, // Blue
  data: (message: string) => `\x1B[38;2;193;156;0m${message}\x1B[0m`, // Orange
  dataLight: (message: string) => `\x1B[38;2;249;241;165m${message}\x1B[0m`, // Yellow Light
  endpoint: (message: string) => `\x1B[38;2;19;161;14m${message}\x1B[0m`, // Green
  fade: (message: string) => `\x1B[90m${message}\x1B[0m`, // Gray
};
