import { names } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const getEnvTempDir = () => process.env.RUNNER_TEMP || os.tmpdir(); // This supports not only local dev but also GitHub Actions

export const createTempFolderWithInit = (tempAppName: string) => {
  const tempName = names(tempAppName).fileName.split('/');
  const tempFolder = fs.mkdtempSync(path.posix.join(getEnvTempDir(), `func-${tempName.pop()}-`));

  try {
    execSync(`func init ${tempAppName} --worker-runtime node --language typescript --skip-npm-install`, {
      cwd: tempFolder,
      stdio: 'ignore',
    });
  } catch (err) {
    fs.rmSync(tempFolder, { recursive: true });
    throw err;
  }

  return { tempFolder, tempProjectRoot: path.posix.join(tempFolder, tempAppName) };
};
