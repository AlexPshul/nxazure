import { ExecutorContext, offsetFromRoot } from '@nx/devkit';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { TS_CONFIG_WORKSPACE_FILE } from '../../common';
import { formatDiagnostics } from './format-diagnostics';

export type CompileOptions = { outputPath: string; parsedTsConfig: ts.ParsedCommandLine; projectName: string; projectRoot: string };

const getAllTsFiles = (dir: string, files: string[] = []): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) getAllTsFiles(fullPath, files);
    else if ((entry.isFile() && fullPath.endsWith('.ts')) || fullPath.endsWith('.tsx')) files.push(fullPath);
  });

  return files;
};

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

const processConfig = (appRoot: string, relativePathToRoot: string) => {
  const sourceTsConfigPath = path.join(appRoot, TS_CONFIG_WORKSPACE_FILE);
  const parsedConfig = readTsConfig(sourceTsConfigPath);
  const config: ts.ParsedCommandLine = {
    ...parsedConfig,
    errors: [...parsedConfig.errors],
    fileNames: [...parsedConfig.fileNames],
    options: { ...parsedConfig.options },
    raw: parsedConfig.raw ? { ...parsedConfig.raw } : parsedConfig.raw,
  };
  const basePaths = parsedConfig.options.paths;

  if (basePaths) {
    const tsFiles = getAllTsFiles(appRoot);
    const program = ts.createProgram(tsFiles, {
      ...parsedConfig.options,
      paths: basePaths,
    });
    const checker = program.getTypeChecker();

    const baseConfigPathsKeys = new Set(Object.keys(basePaths));
    config.options.paths = {};

    const visited = new Set<string>();
    const visitFile = (file: string | ts.SourceFile) => {
      const sourceFile = typeof file === 'string' ? program.getSourceFile(file) : file;
      if (!sourceFile) return;

      if (visited.has(sourceFile.fileName)) return;
      visited.add(sourceFile.fileName);

      ts.forEachChild(sourceFile, node => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          const module = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
          if (baseConfigPathsKeys.has(module) && !config.options.paths?.[module]) {
            config.options.paths ??= {};
            config.options.paths[module] = basePaths[module].map(aliasPath => `${relativePathToRoot}${aliasPath}`);
          }

          const symbol = checker.getSymbolAtLocation(node.moduleSpecifier);
          if (symbol?.declarations) {
            for (const declaration of symbol.declarations) {
              const declarationSourceFile = declaration.getSourceFile();
              if (!declarationSourceFile?.fileName.includes(`${path.sep}node_modules${path.sep}`)) visitFile(declarationSourceFile);
            }
          }
        }
      });
    };

    tsFiles.forEach(visitFile);
  }

  return config;
};

export const prepareBuild = (context: ExecutorContext) => {
  const appRoot = context.projectsConfigurations?.projects[context.projectName].root;
  const relativePathToRoot = offsetFromRoot(appRoot);
  const parsedTsConfig = processConfig(appRoot, relativePathToRoot);
  const outputPath = path.join(appRoot, parsedTsConfig.options.outDir || 'dist');

  parsedTsConfig.options.outDir = outputPath;
  parsedTsConfig.options.noEmitOnError = true;
  parsedTsConfig.options.rootDir = '.';

  if (parsedTsConfig.options.incremental && !parsedTsConfig.options.tsBuildInfoFile) {
    parsedTsConfig.options.tsBuildInfoFile = path.join(outputPath, 'tsconfig.tsbuildinfo');
  }

  const options: CompileOptions = {
    outputPath,
    parsedTsConfig,
    projectName: context.projectName,
    projectRoot: '.',
  };

  return { appRoot, options };
};
