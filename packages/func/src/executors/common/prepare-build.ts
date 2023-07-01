import { ExecutorContext, readJsonFile, writeJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import path from 'path';
import { CompilerOptions, ModuleKind } from 'typescript';
import { TS_CONFIG_BASE_FILE, TS_CONFIG_BUILD_FILE } from '../../common';

const moduleKindMap = new Map<string, ModuleKind>(Object.values(ModuleKind).map((v: ModuleKind) => [v.toString().toLowerCase(), v]));

function parseModuleKind(volumeData: string): ModuleKind {
  return moduleKindMap.get(volumeData) as ModuleKind;
}

export const prepareBuild = (context: ExecutorContext) => {
  const appRoot = context.workspace?.projects[context.projectName].root;

  const configPath = path.join(appRoot, TS_CONFIG_BUILD_FILE);
  const config = readJsonFile<{ compilerOptions: CompilerOptions }>(configPath);

  const baseConfigPath = path.join(context.cwd, TS_CONFIG_BASE_FILE);
  const baseConfig = readJsonFile<{ compilerOptions: CompilerOptions }>(baseConfigPath);

  config.compilerOptions.paths = !baseConfig.compilerOptions.paths
    ? {}
    : Object.keys(baseConfig.compilerOptions.paths).reduce((acc, key) => {
        acc[key] = baseConfig.compilerOptions.paths[key].map(path => `../../${path}`);
        return acc;
      }, {} as Record<string, string[]>);

  writeJsonFile(configPath, config);
  execSync(`npx prettier ${configPath} -w`);

  const outputPath = path.join(appRoot, config.compilerOptions.outDir);

  const module = parseModuleKind(config.compilerOptions.module.toString());

  const options = {
    outputPath,
    projectName: context.projectName,
    projectRoot: '.',
    tsConfig: configPath,
  };

  return { appRoot, options, module: ModuleKind[module] };
};
