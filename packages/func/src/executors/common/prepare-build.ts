import { ExecutorContext, offsetFromRoot, readJsonFile, writeJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import path from 'path';
import { CompilerOptions } from 'typescript';
import { TS_CONFIG_BASE_FILE, TS_CONFIG_BUILD_FILE } from '../../common';

export const prepareBuild = (context: ExecutorContext) => {
  const appRoot = context.workspace?.projects[context.projectName].root;
  const relativePathToRoot = offsetFromRoot(appRoot);

  const configPath = path.join(appRoot, TS_CONFIG_BUILD_FILE);
  const config = readJsonFile<{ compilerOptions: CompilerOptions }>(configPath);

  const baseConfigPath = path.join(context.cwd, TS_CONFIG_BASE_FILE);
  const baseConfig = readJsonFile<{ compilerOptions: CompilerOptions }>(baseConfigPath);

  config.compilerOptions.paths = Object.keys(baseConfig.compilerOptions.paths ?? {}).reduce((acc, key) => {
    acc[key] = baseConfig.compilerOptions.paths[key].map(path => `${relativePathToRoot}${path}`);
    return acc;
  }, config.compilerOptions.paths ?? {});

  writeJsonFile(configPath, config);
  execSync(`npx prettier ${configPath} -w`);

  const outputPath = path.join(appRoot, config.compilerOptions.outDir);

  const options = {
    outputPath,
    projectName: context.projectName,
    projectRoot: '.',
    tsConfig: configPath,
  };

  return { appRoot, options };
};
