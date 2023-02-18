import {
  addProjectConfiguration,
  formatFiles,
  getProjects,
  getWorkspaceLayout,
  installPackagesTask,
  names,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import path from 'path';
import { CompilerOptions } from 'typescript';
import {
  GLOBAL_NAME,
  FUNC_PACKAGE_NAME,
  TS_CONFIG_BASE_FILE,
  TS_CONFIG_BUILD_FILE,
  TS_CONFIG_WORKSPACE_FILE,
  REGISTRATION_FILE,
} from '../../common';
import { InitGeneratorSchema } from './schema';

const AZURE_FUNC_VSCODE_EXTENSION = 'ms-azuretools.vscode-azurefunctions';

type NormalizedOptions = {
  appRoot: string;
  appNames: ReturnType<typeof names>;
  strict: boolean;
};

const normalizeOptions = (tree: Tree, { name, strict }: InitGeneratorSchema): NormalizedOptions => {
  const appNames = names(name);

  const { appsDir } = getWorkspaceLayout(tree);
  const appRoot = path.join(appsDir, appNames.fileName);

  if (tree.exists(appRoot) && tree.children(appRoot).length > 0)
    throw new Error(`Project [${name} (${appNames.fileName})] already exists in the workspace.`);

  return {
    appRoot,
    appNames,
    strict,
  };
};

const createProjectConfigurationFile = (tree: Tree, { appRoot, appNames: { name } }: NormalizedOptions) => {
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
  });
};

const updateVsCodeRecommendations = (tree: Tree) => {
  updateJson(tree, '.vscode/extensions.json', json => {
    json.recommendations = json.recommendations || [];
    if (!json.recommendations.includes(AZURE_FUNC_VSCODE_EXTENSION)) {
      json.recommendations.push(AZURE_FUNC_VSCODE_EXTENSION);
    }

    return json;
  });
};

const updateWorkspacePackageJson = (tree: Tree) => {
  const dependenciesDefaults = {
    'tsconfig-paths': '^4.1.2',
  };

  const devDependenciesDefaults = {
    ['typescript']: '^4.9.4',
    ['@azure/functions']: '^3.0.0',
    ['azure-functions-core-tools']: '^4.x',
    ['@types/node']: '^18.11.18',
  };

  updateJson(tree, 'package.json', json => {
    json.dependencies = json.dependencies || dependenciesDefaults;
    Object.keys(dependenciesDefaults).forEach(key => {
      json.dependencies[key] = json.dependencies[key] || dependenciesDefaults[key];
    });

    json.devDependencies = json.devDependencies || devDependenciesDefaults;
    Object.keys(devDependenciesDefaults).forEach(key => {
      json.devDependencies[key] = json.devDependencies[key] || devDependenciesDefaults[key];
    });

    return json;
  });

  console.log(
    '\x1B[33mATTENTION\x1B[0m',
    'Some dependencies might not work together well. If something is not working, try to update @types/node and/or typescript to the latest versions.',
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
  tree.write(path.join(appRoot, TS_CONFIG_WORKSPACE_FILE), JSON.stringify(workspaceTsConfig, null, 2));

  const buildTsConfig = { compilerOptions: { ...compilerOptions, outDir: 'dist', resolveJsonModule: true } };
  tree.write(path.join(appRoot, TS_CONFIG_BUILD_FILE), JSON.stringify(buildTsConfig, null, 2));
};

const updateBaseTsConfig = (tree: Tree) => {
  updateJson<{ compilerOptions: CompilerOptions }>(tree, TS_CONFIG_BASE_FILE, json => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.resolveJsonModule = true;

    return json;
  });
};

const createProjectPackageJson = (tree: Tree, { appRoot, appNames: { name } }: NormalizedOptions) => {
  // For deployment purposes, project package.json should exist on in every project
  const projectPackageJson = {
    name: name,
    version: '1.0.0',
    description: '',
    scripts: {
      build: 'tsc',
      watch: 'tsc -w',
      prestart: 'npm run build',
      start: 'func start',
      test: 'echo "No tests yet..."',
    },
    dependencies: {},
    devDependencies: {},
  };

  tree.write(path.join(appRoot, 'package.json'), JSON.stringify(projectPackageJson, null, 2));
};

const createHostJson = (tree: Tree, { appRoot }: NormalizedOptions) => {
  const hostData = {
    version: '2.0',
    logging: {
      applicationInsights: {
        samplingSettings: {
          isEnabled: true,
          excludedTypes: 'Request',
        },
      },
    },
    extensionBundle: {
      id: 'Microsoft.Azure.Functions.ExtensionBundle',
      version: '[3.*, 4.0.0)',
    },
  };

  tree.write(path.join(appRoot, 'host.json'), JSON.stringify(hostData, null, 2));
};

const createLocalSettingsJson = (tree: Tree, { appRoot }: NormalizedOptions) => {
  const localSettingsData = {
    IsEncrypted: false,
    Values: {
      AzureWebJobsStorage: 'UseDevelopmentStorage=true',
      FUNCTIONS_WORKER_RUNTIME: 'node',
    },
  };

  tree.write(path.join(appRoot, 'local.settings.json'), JSON.stringify(localSettingsData, null, 2));
};

const createFuncIgnoreFile = (tree: Tree, { appRoot }: NormalizedOptions) =>
  tree.write(
    path.join(appRoot, '.funcignore'),
    `
      *.js.map
      *.ts
      .git*
      .vscode
      local.settings.json
      test
      getting_started.md
      node_modules/@types/
      node_modules/azure-functions-core-tools/
      node_modules/typescript/
    `,
  );

const createRegisterPathsFile = (tree: Tree, { appRoot }: NormalizedOptions) =>
  tree.write(
    path.join(appRoot, REGISTRATION_FILE),
    `
    import { register } from 'tsconfig-paths';
    import * as tsConfig from '../../${TS_CONFIG_BASE_FILE}';

    const newPaths: Record<string, string[]> = Object.entries(tsConfig.compilerOptions.paths).reduce((newPathsObj, [pathKey, oldPaths]: [string, string[]]) => {
      newPathsObj[pathKey] = oldPaths.map(path => path.replace(/.ts$/, '.js'));
      return newPathsObj;
    }, {} as Record<string, string[]>);

    register({
      baseUrl: 'dist',
      paths: newPaths,
    });
    `,
  );

export default async function (tree: Tree, options: InitGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);

  createProjectConfigurationFile(tree, normalizedOptions);
  updateVsCodeRecommendations(tree);
  updateWorkspacePackageJson(tree);
  createTsConfigFiles(tree, normalizedOptions);
  updateBaseTsConfig(tree);
  createProjectPackageJson(tree, normalizedOptions);
  createHostJson(tree, normalizedOptions);
  createLocalSettingsJson(tree, normalizedOptions);
  createFuncIgnoreFile(tree, normalizedOptions);
  createRegisterPathsFile(tree, normalizedOptions);

  await formatFiles(tree);
  installPackagesTask(tree, true);
}
