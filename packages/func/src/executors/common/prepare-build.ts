import { ExecutorContext } from '@nx/devkit';
import path from 'path';
import { getParsedCommandLineOfConfigFile, sys, type ParsedCommandLine } from 'typescript';
import { TS_CONFIG_WORKSPACE_FILE } from '../../common';
import { formatDiagnostics } from './format-diagnostics';

type ParsedTsConfig = ParsedCommandLine & { options: { outDir: string } };
export type CompileOptions = { parsedTsConfig: ParsedTsConfig; projectName: string; projectRoot: string };

const readTsConfig = (tsConfigPath: string) => {
  const parsedConfig = getParsedCommandLineOfConfigFile(
    tsConfigPath,
    {},
    {
      ...sys,
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

const processConfig = (appRoot: string): ParsedTsConfig => {
  const sourceTsConfigPath = path.join(appRoot, TS_CONFIG_WORKSPACE_FILE);
  const parsedConfig = readTsConfig(sourceTsConfigPath);
  const outDir = parsedConfig.options.outDir || path.join(appRoot, 'dist');

  const config: ParsedTsConfig = {
    ...parsedConfig,
    errors: [...parsedConfig.errors],
    fileNames: [...parsedConfig.fileNames],
    options: { ...parsedConfig.options, outDir, noEmitOnError: true, rootDir: '.' },
    raw: parsedConfig.raw ? { ...parsedConfig.raw } : parsedConfig.raw,
  };

  if (config.options.incremental && !config.options.tsBuildInfoFile)
    config.options.tsBuildInfoFile = path.join(config.options.outDir, 'tsconfig.tsbuildinfo');

  return config;
};

export const prepareBuild = (context: ExecutorContext) => {
  const { projectName } = context;
  if (!projectName) throw new Error('Missing projectName in executor context.');

  const appRoot = context.projectsConfigurations?.projects[projectName]?.root;
  if (!appRoot) throw new Error(`Project "${projectName}" not found in workspace configuration.`);

  const parsedTsConfig = processConfig(appRoot);

  const options: CompileOptions = { parsedTsConfig, projectName, projectRoot: '.' };

  return { appRoot, options };
};
