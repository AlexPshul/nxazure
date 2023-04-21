import { Tree } from '@nrwl/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const getEnvTempDir = () => process.env.RUNNER_TEMP || os.tmpdir();

export const createTempFolderWithInit = (tempAppName: string, v4: boolean) => {
  const tempFolder = fs.mkdtempSync(path.posix.join(getEnvTempDir(), `func-${tempAppName}-`));

  try {
    console.info('Command: ', `func init ${tempAppName} --worker-runtime node --language typescript ${v4 ? '--model V4' : ''}`);
    execSync(`func init ${tempAppName} --worker-runtime node --language typescript ${v4 ? '--model V4' : ''}`, {
      cwd: tempFolder,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error(err);
    fs.rmSync(tempFolder, { recursive: true });
    throw err;
  }

  return { tempFolder, tempProjectRoot: path.posix.join(tempFolder, tempAppName) };
};

export const copyToTempFolder = (tree: Tree, projectRootPath: string, v4: boolean) => {
  const tempFolder = fs.mkdtempSync(path.posix.join(getEnvTempDir(), `func-copy-`));

  tree
    .children(projectRootPath)
    .filter(child => tree.isFile(path.posix.join(projectRootPath, child)))
    .map(child => ({ filename: child, fullPath: path.posix.join(projectRootPath, child) }))
    .map(({ filename, fullPath }) => ({ filename, content: tree.read(fullPath).toString() }))
    .forEach(({ filename, content }) => fs.writeFileSync(path.posix.join(tempFolder, filename), content));

  if (v4) fs.mkdirSync(path.posix.join(tempFolder, 'src/functions'), { recursive: true });

  return tempFolder;
};
