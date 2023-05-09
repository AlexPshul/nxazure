import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';
import { compileTypeScript } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { execSync } from 'child_process';
import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import { CompilerOptions, SourceFile, TransformerFactory, Visitor, isImportDeclaration, visitEachChild } from 'typescript';
import { TS_CONFIG_BASE_FILE, TS_CONFIG_BUILD_FILE, registrationFileName } from '../../common';

const createCombinations = (moduleName: string) => {
  const parts = moduleName.split('/');
  const combinations: string[] = [];

  parts.reduce((combined, curr) => {
    const newStr = combined === '' ? curr : `${combined}/${curr}`;
    combinations.push(newStr);
    return newStr;
  }, '');

  return combinations;
};

const findModule = (dependencies: Record<string, string>, moduleName: string) => {
  if (dependencies[moduleName]) return moduleName;

  const moduleCombinations = createCombinations(moduleName);
  return moduleCombinations.find(module => dependencies[module]);
};

const getCopyPackageToAppTransformerFactory = (context: ExecutorContext) => {
  const appRoot = context.workspace?.projects[context.projectName].root;
  const appPackageJson = readJsonFile<{ dependencies: Record<string, string> }>(path.join(appRoot, 'package.json'));
  const originalPackageJson = readJsonFile<{ dependencies: Record<string, string> }>(path.join(context.cwd, 'package.json'));

  const copyPackagesToApp: TransformerFactory<SourceFile> = context => {
    const visitChild: Visitor = node => {
      if (isImportDeclaration(node)) {
        const cleanedModuleName = node.moduleSpecifier.getText().replace(/['"]/g, '');
        const moduleInOriginalPackageJson = findModule(originalPackageJson.dependencies, cleanedModuleName);
        // If the original package.json has the dependency, copy it to the app package.json
        if (
          moduleInOriginalPackageJson &&
          appPackageJson.dependencies[moduleInOriginalPackageJson] !== originalPackageJson.dependencies[moduleInOriginalPackageJson]
        ) {
          appPackageJson.dependencies[moduleInOriginalPackageJson] = originalPackageJson.dependencies[moduleInOriginalPackageJson];
          console.log('\x1B[90m', `Package [${moduleInOriginalPackageJson}] copied to app package.json`, '\x1B[0m');
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

const injectTsPathsV3 = async (appRoot: string, registerPathsFilePath: string) => {
  const functionJsonFiles = await glob('**/function.json', { cwd: appRoot, ignore: ['**/node_modules/**'] });

  const jsFiles = await Promise.all(
    functionJsonFiles
      .map(file => path.join(appRoot, file))
      .map(async file => {
        const { scriptFile } = await readJsonFile<{ scriptFile: string }>(file);
        return path.join(path.dirname(file), scriptFile);
      }),
  );

  await Promise.all(
    jsFiles.map(async filePath => {
      const relativePath = path.relative(path.dirname(filePath), registerPathsFilePath).replace(/\\/g, '/');

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const newJsFileContent = `require('${relativePath}');\n${content}`;
      await fs.promises.writeFile(filePath, newJsFileContent);
    }),
  );
};

export const build = async (context: ExecutorContext) => {
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

  const { success } = compileTypeScript({
    outputPath,
    projectName: context.projectName,
    projectRoot: '.',
    tsConfig: configPath,
    getCustomTransformers: () => ({
      before: [getCopyPackageToAppTransformerFactory(context)],
    }),
  });

  console.log(`Injecting tsconfig paths into function files for project "${context.projectName}"...`);
  const registerPathsFilePath = path.join(outputPath, appRoot, `${registrationFileName}.js`);
  await injectTsPathsV3(appRoot, registerPathsFilePath);
  console.log(`Injected tsconfig paths into function files for project "${context.projectName}".`);

  return success;
};
