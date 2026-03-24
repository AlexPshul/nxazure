import { ExecutorContext } from '@nx/devkit';
import path from 'path';
import ts from 'typescript';
import { TS_CONFIG_WORKSPACE_FILE } from '../../common';
import { formatDiagnostics } from './format-diagnostics';

export type CompileOptions = { parsedTsConfig: ts.ParsedCommandLine; projectName: string; projectRoot: string };

const readTsConfig = (tsConfigPath: string) => {
  const parsedConfig = ts.getParsedCommandLineOfConfigFile(
    tsConfigPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: diagnostic => {
        throw new Error(formatDiagnostics([diagnostic]));
      },
    },
  );

  if (!parsedConfig) {
    throw new Error(`Could not parse TypeScript config at ${tsConfigPath}.`);
  }

  return parsedConfig;
};

const processConfig = (appRoot: string) => {
  const sourceTsConfigPath = path.join(appRoot, TS_CONFIG_WORKSPACE_FILE);
  const parsedConfig = readTsConfig(sourceTsConfigPath);
  const config: ts.ParsedCommandLine = {
    ...parsedConfig,
    errors: [...parsedConfig.errors],
    fileNames: [...parsedConfig.fileNames],
    options: { ...parsedConfig.options },
    raw: parsedConfig.raw ? { ...parsedConfig.raw } : parsedConfig.raw,
  };

  config.options.outDir = config.options.outDir || path.join(appRoot, 'dist');
  config.options.noEmitOnError = true;
  config.options.rootDir = '.';

  if (config.options.incremental && !config.options.tsBuildInfoFile) {
    config.options.tsBuildInfoFile = path.join(config.options.outDir, 'tsconfig.tsbuildinfo');
  }

  return config;
};

export const prepareBuild = (context: ExecutorContext) => {
  const appRoot = context.projectsConfigurations?.projects[context.projectName].root;
  const parsedTsConfig = processConfig(appRoot);

  const options: CompileOptions = {
    parsedTsConfig,
    projectName: context.projectName,
    projectRoot: '.',
  };

  return { appRoot, options };
};
