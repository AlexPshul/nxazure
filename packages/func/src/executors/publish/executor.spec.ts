jest.mock('@nx/devkit', () => ({
  detectPackageManager: jest.fn(),
  getPackageManagerCommand: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../common', () => ({
  build: jest.fn(),
  execWithRetry: jest.fn(),
}));

import { detectPackageManager, ExecutorContext, getPackageManagerCommand } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createSourceFile, ScriptTarget, transform, type CustomTransformers, type SourceFile, type TransformerFactory } from 'typescript';
import { build, execWithRetry } from '../common';
import executor from './executor';

const mockedBuild = build as jest.MockedFunction<typeof build>;
const mockedDetectPackageManager = detectPackageManager as jest.MockedFunction<typeof detectPackageManager>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedExecWithRetry = execWithRetry as jest.MockedFunction<typeof execWithRetry>;
const mockedGetPackageManagerCommand = getPackageManagerCommand as jest.MockedFunction<typeof getPackageManagerCommand>;

const runAfterTransformers = (workspaceRoot: string, appRoot: string, customTransformers?: CustomTransformers) => {
  const afterTransformers = (customTransformers?.after ?? []) as TransformerFactory<SourceFile>[];
  const emittedFiles = [
    {
      fileName: path.join(workspaceRoot, appRoot, 'dist', 'apps', 'demo-app', 'src', 'functions', 'handler.js'),
      source: [
        "import { app } from '@azure/functions';",
        "import alpha from 'alpha';",
        "import { sharedValue } from '../../../../libs/shared.js';",
        "export { betaValue } from 'beta/subpath';",
        "import { coolFunc } from 'cool-package/specific/sub-path';",
        "const gammaValue = require('gamma/subpath');",
        'void app;',
        'void alpha;',
        'void sharedValue;',
        'void coolFunc;',
        'void gammaValue;',
        'async function load() {',
        "  const dynamicValue = await import('delta');",
        '  void dynamicValue;',
        '}',
        'void load;',
      ].join('\n'),
    },
    {
      fileName: path.join(workspaceRoot, appRoot, 'dist', 'libs', 'shared.js'),
      source: "import { nestedValue } from './nested.js';\nexport const sharedValue = nestedValue;\n",
    },
    {
      fileName: path.join(workspaceRoot, appRoot, 'dist', 'libs', 'nested.js'),
      source: "import transitiveValue from 'transitive';\nexport const nestedValue = transitiveValue;\n",
    },
  ];

  emittedFiles.forEach(({ fileName, source }) => {
    let sourceFile = createSourceFile(fileName, source, ScriptTarget.Latest, true);

    afterTransformers.forEach(transformer => {
      const result = transform(sourceFile, [transformer]);
      sourceFile = result.transformed[0] as SourceFile;
      result.dispose();
    });
  });
};

const createWorkspace = () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nxazure-func-publish-'));
  const appRoot = path.join('apps', 'demo-app');
  const appRootPath = path.join(workspaceRoot, appRoot);

  fs.mkdirSync(path.join(appRootPath, 'src', 'functions'), { recursive: true });
  fs.mkdirSync(path.join(workspaceRoot, 'libs'), { recursive: true });

  fs.writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'workspace',
        version: '1.0.0',
        dependencies: {
          '@azure/functions': '^4.11.2',
          alpha: '1.0.0',
          beta: '2.0.0',
          'cool-package/specific': '2.5.0',
          delta: '4.0.0',
          gamma: '3.0.0',
          shared: '7.0.0',
          transitive: '6.0.0',
          'type-only': '5.0.0',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(workspaceRoot, 'tsconfig.base.json'),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: '.',
          module: 'esnext',
          moduleResolution: 'node',
          paths: {
            shared: ['libs/shared.ts'],
          },
          target: 'es2015',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(appRootPath, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-app',
        version: '1.0.0',
        dependencies: {
          '@azure/functions': '^4.11.2',
          beta: '22.22.22',
          'manual-only': '8.8.8',
        },
        devDependencies: {
          gamma: '9.9.9',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(appRootPath, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: 'dist',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(appRootPath, 'src', 'functions', 'local.ts'), 'export const localValue = 1;\n');
  fs.writeFileSync(
    path.join(workspaceRoot, 'libs', 'nested.ts'),
    "import transitiveValue from 'transitive';\nexport const nestedValue = transitiveValue;\n",
  );
  fs.writeFileSync(
    path.join(workspaceRoot, 'libs', 'shared.ts'),
    "import { nestedValue } from './nested';\nexport const sharedValue = nestedValue;\n",
  );
  fs.writeFileSync(
    path.join(appRootPath, 'src', 'functions', 'handler.ts'),
    [
      "import { app } from '@azure/functions';",
      "import alpha from 'alpha';",
      "import type { TypeOnlyImport } from 'type-only';",
      "import { localValue } from './local';",
      "import { sharedValue } from 'shared';",
      "export { betaValue } from 'beta/subpath';",
      "import { coolFunc } from 'cool-package/specific/sub-path';",
      "export type { TypeOnlyExport } from 'type-only';",
      "const gammaValue = require('gamma/subpath');",
      '',
      'void app;',
      'void alpha;',
      'void localValue;',
      'void sharedValue;',
      'void coolFunc;',
      'void gammaValue;',
      'void (async () => {',
      "  const dynamicValue = await import('delta');",
      '  void dynamicValue;',
      '})();',
      '',
      'type _KeepTypes = TypeOnlyImport | TypeOnlyExport;',
      'void (null as unknown as _KeepTypes);',
      '',
    ].join('\n'),
  );

  return { appRoot, appRootPath, workspaceRoot };
};

const createContext = (workspaceRoot: string, appRoot: string) =>
  ({
    cwd: workspaceRoot,
    isVerbose: false,
    projectName: 'demo-app',
    projectsConfigurations: {
      projects: {
        'demo-app': {
          root: appRoot,
          targets: {
            build: {
              options: {},
            },
          },
        },
      },
    },
    root: workspaceRoot,
    target: {
      executor: '@nxazure/func:publish',
    },
  }) as unknown as ExecutorContext;

describe('publish executor', () => {
  const originalCwd = process.cwd();
  const tempDirs: string[] = [];

  beforeEach(() => {
    mockedBuild.mockImplementation(async (context, customTransformers) => {
      const configuredProjectRoot = context.projectsConfigurations?.projects[context.projectName].root;
      if (!configuredProjectRoot) {
        throw new Error('Missing project root in test context');
      }

      runAfterTransformers(context.cwd, configuredProjectRoot, customTransformers);
      return true;
    });
    mockedDetectPackageManager.mockReturnValue('npm');
    mockedExecSync.mockReset();
    mockedExecWithRetry.mockReset();
    mockedGetPackageManagerCommand.mockReturnValue({ install: 'npm install' } as ReturnType<typeof getPackageManagerCommand>);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    jest.clearAllMocks();
    tempDirs.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it('temporarily adds missing runtime dependencies during publish and restores the original app manifest', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace();
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    const originalAppPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');
    let installPackageJson = '';

    tempDirs.push(workspaceRoot);
    process.chdir(workspaceRoot);

    mockedExecSync.mockImplementation((_command, options) => {
      const cwd = options?.cwd as string;
      installPackageJson = fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8');
      fs.mkdirSync(path.join(cwd, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'package-lock.json'), 'generated lockfile');
      return Buffer.alloc(0);
    });

    await expect(executor({ additionalFlags: '--slot test', name: 'azure-demo' }, createContext(workspaceRoot, appRoot))).resolves.toEqual({
      success: true,
    });

    const temporaryPackageJson = JSON.parse(installPackageJson) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(temporaryPackageJson.dependencies).toEqual({
      '@azure/functions': '^4.11.2',
      alpha: '1.0.0',
      beta: '22.22.22',
      'cool-package/specific': '2.5.0',
      delta: '4.0.0',
      gamma: '3.0.0',
      'manual-only': '8.8.8',
      transitive: '6.0.0',
    });
    expect(temporaryPackageJson.devDependencies).toEqual({
      gamma: '9.9.9',
    });
    expect(temporaryPackageJson.dependencies).not.toHaveProperty('shared');
    expect(temporaryPackageJson.dependencies).not.toHaveProperty('type-only');
    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalAppPackageJson);
    expect(fs.existsSync(path.join(appRootPath, 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(appRootPath, 'package-lock.json'))).toBe(false);
    expect(mockedBuild).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        after: [expect.any(Function)],
      }),
    );
    expect(mockedExecSync).toHaveBeenCalledWith('npm install', expect.objectContaining({ cwd: appRootPath, stdio: 'inherit' }));
    expect(mockedExecWithRetry).toHaveBeenCalledWith('Publish', 'func azure functionapp publish azure-demo --slot test', {
      cwd: appRootPath,
      stdio: 'inherit',
    });
  });

  it('restores the original package.json and lockfile when publish fails', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace();
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    const lockfilePath = path.join(appRootPath, 'package-lock.json');
    const originalAppPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');

    tempDirs.push(workspaceRoot);
    process.chdir(workspaceRoot);
    fs.writeFileSync(lockfilePath, 'original lockfile');

    mockedExecSync.mockImplementation((_command, options) => {
      const cwd = options?.cwd as string;
      fs.mkdirSync(path.join(cwd, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'package-lock.json'), 'modified lockfile');
      return Buffer.alloc(0);
    });
    mockedExecWithRetry.mockImplementation(() => {
      throw new Error('publish failed');
    });

    await expect(executor({ additionalFlags: '', name: 'azure-demo' }, createContext(workspaceRoot, appRoot))).rejects.toThrow(
      'publish failed',
    );

    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalAppPackageJson);
    expect(fs.readFileSync(lockfilePath, 'utf-8')).toBe('original lockfile');
    expect(fs.existsSync(path.join(appRootPath, 'node_modules'))).toBe(false);
  });
});
