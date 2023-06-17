import { readJsonFile } from '@nx/devkit';

export const color = {
  error: (message: string) => `\x1B[31m${message}\x1B[0m`, // Red
  warn: (message: string) => `\x1B[33m${message}\x1B[0m`, // Yellow
  info: (message: string) => `\x1B[34m${message}\x1B[0m`, // Blue
  data: (message: string) => `\x1B[38;2;193;156;0m${message}\x1B[0m`, // Orange
  endpoint: (message: string) => `\x1B[38;2;19;161;14m${message}\x1B[0m`, // Green
  fade: (message: string) => `\x1B[90m${message}\x1B[0m`, // Gray
};

const isV4PackageRegex = /^[^0-9]*4/;
export const isV4 = () => {
  const { dependencies } = readJsonFile<{ dependencies?: Record<string, string> }>('package.json');
  const funcPackageVersion = dependencies?.['@azure/functions'];

  return funcPackageVersion && isV4PackageRegex.test(funcPackageVersion);
};
