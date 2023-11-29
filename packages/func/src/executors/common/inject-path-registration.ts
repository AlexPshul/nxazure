import { readJsonFile } from '@nx/devkit';
import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import { registrationFileName } from '../../common';

const getFilesForPathInjection = async (appRoot: string) => {
  const { main: functionsPathPattern } = readJsonFile<{ main: string }>(path.join(appRoot, 'package.json'));

  const functionsPath = path.posix.join(appRoot, functionsPathPattern);
  const functions = await glob(functionsPath);

  return functions;
};

export const injectPathRegistration = async (outputPath: string, appRoot: string) => {
  const registerPathsFilePath = path.join(outputPath, appRoot, `${registrationFileName}.js`);
  const filesToInject = await getFilesForPathInjection(appRoot);

  await Promise.all(
    filesToInject.map(async filePath => {
      const relativePath = path.relative(path.dirname(filePath), registerPathsFilePath).replace(/\\/g, '/');

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const newJsFileContent = `require('${relativePath}');\n${content}`;
      await fs.promises.writeFile(filePath, newJsFileContent);
    }),
  );
};
