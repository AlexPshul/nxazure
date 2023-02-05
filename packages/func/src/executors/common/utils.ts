import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';
import { compileTypeScript } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { execSync } from 'child_process';
import path from 'path';
import { CompilerOptions, SourceFile, TransformerFactory, visitEachChild, Visitor, isImportDeclaration } from 'typescript';
import { TS_CONFIG_BASE_FILE, TS_CONFIG_BUILD_FILE } from '../../common';

const getCopyPackageToAppTransformerFactory = (context: ExecutorContext) => {
  const appRoot = context.workspace?.projects[context.projectName].root;
  const appPackageJson = readJsonFile<{ dependencies: Record<string, string> }>(path.join(appRoot, 'package.json'));
  const originalPackageJson = readJsonFile<{ dependencies: Record<string, string> }>(path.join(context.cwd, 'package.json'));

  const copyPackagesToApp: TransformerFactory<SourceFile> = context => {
    const visitChild: Visitor = node => {
      if (isImportDeclaration(node)) {
        const cleanedModuleName = node.moduleSpecifier.getText().replace(/['"]/g, '');
        // If the original package.json has the dependency, copy it to the app package.json
        if (
          originalPackageJson.dependencies[cleanedModuleName] &&
          appPackageJson.dependencies[cleanedModuleName] !== originalPackageJson.dependencies[cleanedModuleName]
        ) {
          appPackageJson.dependencies[cleanedModuleName] = originalPackageJson.dependencies[cleanedModuleName];
          console.log('\x1B[90m', `Package [${cleanedModuleName}] copied to app package.json`, '\x1B[0m');
        }
      }
      return node;
    };

    return sourceFile => {
      const resultSourceFile = visitEachChild(sourceFile, visitChild, context);
      writeJsonFile(path.join(appRoot, 'package.json'), appPackageJson);

      return resultSourceFile;
    };
  };

  return copyPackagesToApp;
};

export const build = (context: ExecutorContext) => {
  const appRoot = context.workspace?.projects[context.projectName].root;

  const configPath = path.join(appRoot, TS_CONFIG_BUILD_FILE);
  const config = readJsonFile<{ compilerOptions: CompilerOptions }>(configPath);

  const baseConfigPath = path.join(context.cwd, TS_CONFIG_BASE_FILE);
  const baseConfig = readJsonFile<{ compilerOptions: CompilerOptions }>(baseConfigPath);
  config.compilerOptions.baseUrl = baseConfig.compilerOptions.baseUrl;

  config.compilerOptions.paths = Object.keys(baseConfig.compilerOptions.paths).reduce((acc, key) => {
    acc[key] = baseConfig.compilerOptions.paths[key].map(path => `../../${path}`);
    return acc;
  }, {} as Record<string, string[]>);
  writeJsonFile(configPath, config);
  execSync(`npx prettier ${configPath} -w`);

  const { success } = compileTypeScript({
    outputPath: path.join(appRoot, config.compilerOptions.outDir),
    projectName: context.projectName,
    projectRoot: '.',
    tsConfig: configPath,
    getCustomTransformers: () => ({
      before: [getCopyPackageToAppTransformerFactory(context)],
    }),
  });

  return success;
};
