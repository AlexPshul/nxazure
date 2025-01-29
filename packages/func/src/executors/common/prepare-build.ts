import { ExecutorContext, offsetFromRoot, readJsonFile, writeJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import ts, { CompilerOptions } from 'typescript';
import { TS_CONFIG_BASE_FILE, TS_CONFIG_BUILD_FILE } from '../../common';

type TsConfig = { compilerOptions: CompilerOptions };

const getAllTsFiles = (dir: string, files: string[] = []): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) getAllTsFiles(fullPath, files);
    else if ((entry.isFile() && fullPath.endsWith('.ts')) || fullPath.endsWith('.tsx')) files.push(fullPath);
  });

  return files;
};

const processConfig = (appRoot: string, cwd: string, relativePathToRoot: string) => {
  const configPath = path.join(appRoot, TS_CONFIG_BUILD_FILE);
  const config = readJsonFile<TsConfig>(configPath);

  const baseConfigPath = path.join(cwd, TS_CONFIG_BASE_FILE);
  const baseConfig = readJsonFile<TsConfig>(baseConfigPath);
  const parsedConfigFile = ts.parseJsonConfigFileContent(baseConfig, ts.sys, appRoot);

  if (baseConfig.compilerOptions.paths) {
    const tsFiles = getAllTsFiles(appRoot);
    const program = ts.createProgram(tsFiles, parsedConfigFile.options);
    const checker = program.getTypeChecker();

    const baseConfigPathsKeys = new Set(Object.keys(baseConfig.compilerOptions.paths));
    config.compilerOptions.paths = {};

    const visited = new Set<string>();
    const visitFile = (file: string | ts.SourceFile) => {
      const sourceFile = typeof file === 'string' ? program.getSourceFile(file) : file;
      if (!sourceFile) return;

      if (visited.has(sourceFile.fileName)) return;
      visited.add(sourceFile.fileName);

      ts.forEachChild(sourceFile, node => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          // recordModuleAndGoDeeper(node.moduleSpecifier, sourceFile);
          const module = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
          if (baseConfigPathsKeys.has(module) && !config.compilerOptions.paths[module])
            config.compilerOptions.paths[module] = baseConfig.compilerOptions.paths[module].map(path => `${relativePathToRoot}${path}`);

          const symbol = checker.getSymbolAtLocation(node.moduleSpecifier);
          if (symbol?.declarations) {
            for (const declaration of symbol.declarations) {
              const sourceFile = declaration.getSourceFile();
              if (!sourceFile?.fileName.includes('/node_modules/')) visitFile(sourceFile);
            }
          }
        }
      });
    };

    tsFiles.forEach(visitFile);
  }

  writeJsonFile(configPath, config);
  execSync(`npx prettier ${configPath} -w`);

  return { config, configPath };
};

export const prepareBuild = (context: ExecutorContext) => {
  const appRoot = context.projectsConfigurations?.projects[context.projectName].root;
  const relativePathToRoot = offsetFromRoot(appRoot);

  const { config, configPath } = processConfig(appRoot, context.cwd, relativePathToRoot);

  const outputPath = path.join(appRoot, config.compilerOptions.outDir);

  const options = {
    outputPath,
    projectName: context.projectName,
    projectRoot: '.',
    tsConfig: configPath,
  };

  return { appRoot, options };
};
