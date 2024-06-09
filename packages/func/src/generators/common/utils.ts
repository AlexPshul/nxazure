import { Tree, names } from '@nx/devkit';
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

export const copyToTempFolder = (tree: Tree, projectRootPath: string) => {
  const tempFolder = fs.mkdtempSync(path.posix.join(getEnvTempDir(), `func-copy-`));

  tree
    .children(projectRootPath)
    .filter(child => tree.isFile(path.posix.join(projectRootPath, child)))
    .map(child => ({ filename: child, fullPath: path.posix.join(projectRootPath, child) }))
    .map(({ filename, fullPath }) => ({ filename, content: tree.read(fullPath).toString() }))
    .forEach(({ filename, content }) => fs.writeFileSync(path.posix.join(tempFolder, filename), content));

  fs.mkdirSync(path.posix.join(tempFolder, 'src/functions'), { recursive: true });

  return tempFolder;
};
