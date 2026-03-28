import { ExecutorContext, readJsonFile, writeJsonFile } from '@nx/devkit';
import path from 'path';
import { ModuleKind, type CompilerOptions } from 'typescript';

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

const emitsEsm = (moduleKind: ModuleKind | undefined) =>
  moduleKind !== undefined &&
  moduleKind !== ModuleKind.CommonJS &&
  moduleKind !== ModuleKind.AMD &&
  moduleKind !== ModuleKind.UMD &&
  moduleKind !== ModuleKind.System &&
  moduleKind !== ModuleKind.None;

export const createAppPackageJsonUpdater = (context: ExecutorContext, compilerOptions: CompilerOptions) => {
  const appRoot = context.projectsConfigurations?.projects[context.projectName].root;
  const appPackageJsonPath = path.join(appRoot, 'package.json');
  const appPackageJson = readJsonFile<{ dependencies?: Record<string, string>; type?: string }>(appPackageJsonPath);
  const originalPackageJson = readJsonFile<{ dependencies?: Record<string, string> }>(path.join(context.cwd, 'package.json'));
  const originalDependencies = originalPackageJson.dependencies ?? {};
  let isAppPackageJsonDirty = false;

  if (emitsEsm(compilerOptions.module)) {
    if (appPackageJson.type !== 'module') {
      appPackageJson.type = 'module';
      isAppPackageJsonDirty = true;
    }
  } else if ('type' in appPackageJson) {
    delete appPackageJson.type;
    isAppPackageJsonDirty = true;
  }

  return {
    handleModuleSpecifier(moduleName: string) {
      const moduleInOriginalPackageJson = findModule(originalDependencies, moduleName);
      if (!moduleInOriginalPackageJson) return;

      if (!appPackageJson.dependencies) {
        appPackageJson.dependencies = {};
        isAppPackageJsonDirty = true;
      }
      if (appPackageJson.dependencies[moduleInOriginalPackageJson] === originalDependencies[moduleInOriginalPackageJson]) return;

      appPackageJson.dependencies[moduleInOriginalPackageJson] = originalDependencies[moduleInOriginalPackageJson];
      isAppPackageJsonDirty = true;
      console.log('\x1B[90m', `Package [${moduleInOriginalPackageJson}] copied to app package.json`, '\x1B[0m');
    },
    flush() {
      if (!isAppPackageJsonDirty) return;

      writeJsonFile(appPackageJsonPath, appPackageJson);
      isAppPackageJsonDirty = false;
    },
  };
};
