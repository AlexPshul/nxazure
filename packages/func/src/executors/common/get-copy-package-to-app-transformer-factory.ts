import { ExecutorContext, readJsonFile, writeJsonFile } from '@nx/devkit';
import path from 'path';
import { SourceFile, TransformerFactory, Visitor, isImportDeclaration, visitEachChild } from 'typescript';

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

export const getCopyPackageToAppTransformerFactory = (context: ExecutorContext) => {
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
