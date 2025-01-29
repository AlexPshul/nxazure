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

  if (baseConfig.compilerOptions.paths) {
    const tsFiles = getAllTsFiles(appRoot);
    const program = ts.createProgram(tsFiles, {});
    const foundModules = new Set<string>();

    for (const file of tsFiles) {
      const sourceFile = program.getSourceFile(file);
      if (!sourceFile) continue;

      ts.forEachChild(sourceFile, node => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
          const moduleName = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
          if (!foundModules.has(moduleName)) foundModules.add(moduleName);
        }
      });
    }

    config.compilerOptions.paths = {};
    const baseConfigPathsKeys = new Set(Object.keys(baseConfig.compilerOptions.paths));
    for (const module of foundModules) {
      if (baseConfigPathsKeys.has(module))
        config.compilerOptions.paths[module] = baseConfig.compilerOptions.paths[module].map(path => `${relativePathToRoot}${path}`);
    }
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
