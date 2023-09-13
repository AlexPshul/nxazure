import {
  addProjectConfiguration,
  formatFiles,
  getProjects,
  getWorkspaceLayout,
  installPackagesTask,
  names,
  offsetFromRoot,
  readJsonFile,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import fs, { readFileSync } from 'fs';
import path from 'path';
import { CompilerOptions } from 'typescript';
import {
  color,
  FUNC_PACKAGE_NAME,
  GLOBAL_NAME,
  registrationFileName,
  TS_CONFIG_BASE_FILE,
  TS_CONFIG_BUILD_FILE,
  TS_CONFIG_WORKSPACE_FILE,
} from '../../common';
import { createTempFolderWithInit } from '../common';
import { InitGeneratorSchema } from './schema';

type NormalizedOptions = {
  appRoot: string;
  appNames: ReturnType<typeof names>;
  strict: boolean;
  v4: boolean;
  tags: string[];
};

const staticFilesToCopy = ['host.json', 'local.settings.json', '.funcignore'];

const normalizeOptions = (tree: Tree, { name, strict, v4, tags }: InitGeneratorSchema): NormalizedOptions => {
  const appNames = names(name);

  const { appsDir } = getWorkspaceLayout(tree);
  const appRoot = path.posix.join(appsDir, appNames.fileName);

  if (tree.exists(appRoot) && tree.children(appRoot).length > 0)
    throw new Error(`Project [${name} (${appNames.fileName})] already exists in the workspace.`);

  if (v4) console.log(color.warn('The V4 model is currently in preview. Use with caution.'));

  return {
    appRoot,
    appNames,
    strict,
    v4,
    tags: tags?.split(',').map(s => s.trim()) || [],
  };
};

const createProjectConfigurationFile = (tree: Tree, { appRoot, appNames: { name }, tags }: NormalizedOptions) => {
  const maxPort = Array.from(getProjects(tree).values())
    .filter(project => !!project.name)
    .map(project => readProjectConfiguration(tree, project.name))
    .filter(projectConfig => projectConfig.targets?.start?.executor === `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:start`)
    .reduce((max, projectConfig) => Math.max(max, projectConfig.targets?.start?.options?.port || 0), 7070);

  addProjectConfiguration(tree, name, {
    root: appRoot,
    name: name,
    projectType: 'application',
    targets: {
      build: {
        executor: `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:build`,
      },
      start: {
        executor: `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:start`,
        options: {
          port: maxPort + 1,
        },
      },
      publish: {
        executor: `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:publish`,
      },
    },
    tags,
  });
};

const updateVsCodeRecommendations = (tree: Tree, copyFromFolder: string) => {
  const sourceExtensionJson = readJsonFile<{ recommendations: string[] }>(path.posix.join(copyFromFolder, '.vscode/extensions.json'));

  if (!tree.exists('.vscode/extensions.json')) tree.write('.vscode/extensions.json', '{}');

  updateJson(tree, '.vscode/extensions.json', json => {
    json.recommendations = json.recommendations || [];
    sourceExtensionJson.recommendations
      .filter(extension => !json.recommendations.includes(extension))
      .forEach(extension => json.recommendations.push(extension));

    return json;
  });
};

const updateWorkspacePackageJson = (tree: Tree, copyFromFolder: string) => {
  // Get the packageJson from the temp folder
  const sourcePackageJson = readJsonFile<{ dependencies: Record<string, string>; devDependencies: Record<string, string> }>(
    path.posix.join(copyFromFolder, 'package.json'),
  );

  const additionalDependencies = { 'tsconfig-paths': '^4.2.0' };
  const sourceDependencies = { ...sourcePackageJson.dependencies, ...additionalDependencies };

  updateJson(tree, 'package.json', json => {
    json.dependencies = json.dependencies || {};
    Object.keys(sourceDependencies).forEach(key => {
      json.dependencies[key] = json.dependencies[key] || sourceDependencies[key];
    });

    json.devDependencies = json.devDependencies || {};

    // In most new instances, Node 18 is used. V3 model is using 16.x, which fails on build in that case.
    // After V3 is deprecated, this can be removed.
    sourcePackageJson.devDependencies['@types/node'] = '18.x';

    Object.keys(sourcePackageJson.devDependencies).forEach(key => {
      json.devDependencies[key] = json.devDependencies[key] || sourcePackageJson.devDependencies[key];
    });

    // For V4, the @azure/functions package is moved from devDependencies to dependencies
    if (sourceDependencies['@azure/functions'] && json.devDependencies['@azure/functions']) {
      console.log(color.warn('ATTENTION'), 'Upgrading to V4 model requires you to upgrade ALL your existing functions');
      delete json.devDependencies['@azure/functions'];
    }

    return json;
  });

  console.log(
    color.warn('ATTENTION'),
    'Some dependencies might not work well together. If something is not working, try to update @types/node, typescript or @azure/functions to the latest (preview for V4) versions.',
  );
};

const createTsConfigFiles = (tree: Tree, { appRoot, strict }: NormalizedOptions) => {
  const relativePathToRoot = offsetFromRoot(appRoot);

  const compilerOptions = {
    module: 'commonjs',
    target: 'es6',
    sourceMap: true,
    strict,
  };

  const workspaceTsConfig = { extends: `${relativePathToRoot}${TS_CONFIG_BASE_FILE}`, compilerOptions };
  tree.write(path.posix.join(appRoot, TS_CONFIG_WORKSPACE_FILE), JSON.stringify(workspaceTsConfig, null, 2));

  const buildTsConfig = { compilerOptions: { ...compilerOptions, outDir: 'dist', resolveJsonModule: true } };
  tree.write(path.posix.join(appRoot, TS_CONFIG_BUILD_FILE), JSON.stringify(buildTsConfig, null, 2));
};

const updateBaseTsConfig = (tree: Tree) => {
  if (!tree.exists(TS_CONFIG_BASE_FILE)) tree.write(TS_CONFIG_BASE_FILE, '{}');

  updateJson<{ compilerOptions: CompilerOptions }>(tree, TS_CONFIG_BASE_FILE, json => {
    json.compilerOptions = json.compilerOptions || { baseUrl: '.' };
    json.compilerOptions.resolveJsonModule = true;

    return json;
  });
};

const createProjectPackageJson = (tree: Tree, { appRoot, v4 }: NormalizedOptions, copyFromFolder: string) => {
  // This needs to be copied and dependencies + devDependencies removed
  const sourcePackageJson = readJsonFile<{ dependencies: Record<string, string>; devDependencies: Record<string, string>; main: string }>(
    path.posix.join(copyFromFolder, 'package.json'),
  );

  const azureFunctionsVersion = sourcePackageJson.dependencies['@azure/functions'];
  sourcePackageJson.dependencies = v4 ? { ['@azure/functions']: azureFunctionsVersion } : {};
  sourcePackageJson.devDependencies = {};

  if (v4) sourcePackageJson.main = `dist/${appRoot}/src/functions/*.js`;

  tree.write(path.posix.join(appRoot, 'package.json'), JSON.stringify(sourcePackageJson, null, 2));
};

const copyFilesFromTemp = (tree: Tree, { appRoot }: NormalizedOptions, tempFolder: string, fileNames: string[]) => {
  fileNames.forEach(fileName => {
    const data = readFileSync(path.posix.join(tempFolder, fileName));
    tree.write(path.posix.join(appRoot, fileName), data);
  });
};

const createRegisterPathsFile = (tree: Tree, { appRoot }: NormalizedOptions) =>
  tree.write(
    path.posix.join(appRoot, `${registrationFileName}.ts`),
    `
    import { register } from 'tsconfig-paths';
    import * as tsConfig from '../../${TS_CONFIG_BASE_FILE}';
    import { CompilerOptions } from 'typescript';

    const compilerOptions = tsConfig.compilerOptions as unknown as CompilerOptions; // This is to avoid any problems with the typing system

    if (compilerOptions.paths) {
      const newPaths: Record<string, string[]> = Object.entries(
        compilerOptions.paths
      ).reduce((newPathsObj, [pathKey, oldPaths]: [string, string[]]) => {
        newPathsObj[pathKey] = oldPaths.map((path) => path.replace(/.ts$/, '.js'));
        return newPathsObj;
      }, {} as Record<string, string[]>);

      register({
        baseUrl: 'dist',
        paths: newPaths,
      });
    }
    `,
  );

const configureEslint = (tree: Tree, { appRoot, appNames: { name } }: NormalizedOptions) => {
  if (!tree.exists('.eslintrc.json')) return;

  const relativePathToRoot = offsetFromRoot(appRoot);
  const projectJsonPath = `${appRoot}/tsconfig.*?.json`;

  const projectEslintConfig = {
    extends: `${relativePathToRoot}.eslintrc.json`,
    ignorePatterns: ['!**/*'],
    rules: {},
    overrides: [
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        parserOptions: {
          project: [path.posix.join(...projectJsonPath.split(path.sep))],
        },
        rules: {},
      },
      {
        files: ['*.ts', '*.tsx'],
        rules: {},
      },
      {
        files: ['*.js', '*.jsx'],
        rules: {},
      },
    ],
  };

  tree.write(path.posix.join(appRoot, '.eslintrc.json'), JSON.stringify(projectEslintConfig, null, 2));

  const projectConfig = readProjectConfiguration(tree, name);
  projectConfig.targets.lint = {
    executor: '@nx/linter:eslint',
    options: {
      lintFilePatterns: [`apps/${name}/**/*.ts`],
    },
    outputs: ['{options.outputFile}'],
  };

  updateProjectConfiguration(tree, name, projectConfig);
};

export default async function (tree: Tree, options: InitGeneratorSchema) {
  const originalConsoleLog = console.log;
  if (options.silent) console.log = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

  const normalizedOptions = normalizeOptions(tree, options);
  const { tempFolder, tempProjectRoot } = createTempFolderWithInit(normalizedOptions.appNames.fileName, normalizedOptions.v4);

  try {
    createProjectConfigurationFile(tree, normalizedOptions);
    updateVsCodeRecommendations(tree, tempProjectRoot);
    updateWorkspacePackageJson(tree, tempProjectRoot);
    createTsConfigFiles(tree, normalizedOptions);
    updateBaseTsConfig(tree);
    createProjectPackageJson(tree, normalizedOptions, tempProjectRoot);
    copyFilesFromTemp(tree, normalizedOptions, tempProjectRoot, staticFilesToCopy);
    createRegisterPathsFile(tree, normalizedOptions);
    configureEslint(tree, normalizedOptions);

    await formatFiles(tree);
    installPackagesTask(tree, true);
  } catch (e) {
    console.error(e); // Helps with debugging tests
    throw e;
  } finally {
    console.log = originalConsoleLog;
    fs.rmSync(tempFolder, { recursive: true });
  }
}
