jest.mock('@nx/devkit', () => ({
  detectPackageManager: jest.fn(),
  getPackageManagerCommand: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../common', () => {
  const actual = jest.requireActual('../common');

  return {
    ...actual,
    build: jest.fn(),
  };
});

import { detectPackageManager, ExecutorContext, getPackageManagerCommand } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createSourceFile, ScriptTarget, transform, type CustomTransformers, type SourceFile, type TransformerFactory } from 'typescript';
import { build } from '../common';
import executor from './executor';

const mockedBuild = build as jest.MockedFunction<typeof build>;
const mockedDetectPackageManager = detectPackageManager as jest.MockedFunction<typeof detectPackageManager>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
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

const createWorkspace = (options: { appDependencies?: Record<string, string> } = {}) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nxazure-func-build-executor-'));
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
          transitive: '6.0.0',
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
          'manual-only': '8.8.8',
          ...(options.appDependencies ?? {}),
        },
      },
      null,
      2,
    ),
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
      executor: '@nxazure/func:build',
    },
  }) as unknown as ExecutorContext;

describe('build executor', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    mockedBuild.mockImplementation(async (context, customTransformers) => {
      const projectName = context.projectName;
      if (!projectName) throw new Error('Missing projectName in test context');
      const configuredProjectRoot = context.projectsConfigurations?.projects[projectName]?.root;
      if (!configuredProjectRoot) throw new Error('Missing project root in test context');

      runAfterTransformers(context.cwd, configuredProjectRoot, customTransformers);
      return true;
    });
    mockedDetectPackageManager.mockReturnValue('npm');
    mockedExecSync.mockReset();
    mockedGetPackageManagerCommand.mockReturnValue({ install: 'npm install' } as ReturnType<typeof getPackageManagerCommand>);
  });

  afterEach(() => {
    jest.clearAllMocks();
    tempDirs.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it('does not mutate package.json or install dependencies by default', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace();
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    const originalAppPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');
    tempDirs.push(workspaceRoot);

    await expect(executor({}, createContext(workspaceRoot, appRoot))).resolves.toEqual({ success: true });

    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalAppPackageJson);
    expect(mockedBuild).toHaveBeenCalledWith(expect.anything());
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('persists missing runtime dependencies in update mode without installing packages', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace({
      appDependencies: {
        beta: '22.22.22',
      },
    });
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    tempDirs.push(workspaceRoot);

    await expect(executor({ packageJsonDependencySync: 'update' }, createContext(workspaceRoot, appRoot))).resolves.toEqual({
      success: true,
    });

    const packageJson = JSON.parse(fs.readFileSync(appPackageJsonPath, 'utf-8')) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies).toEqual({
      '@azure/functions': '^4.11.2',
      alpha: '1.0.0',
      beta: '22.22.22',
      'cool-package/specific': '2.5.0',
      delta: '4.0.0',
      gamma: '3.0.0',
      'manual-only': '8.8.8',
      transitive: '6.0.0',
    });
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('persists missing runtime dependencies and installs packages in install mode', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace();
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    tempDirs.push(workspaceRoot);
    mockedDetectPackageManager.mockReturnValue('pnpm');
    mockedGetPackageManagerCommand.mockReturnValue({ install: 'pnpm install' } as ReturnType<typeof getPackageManagerCommand>);
    mockedExecSync.mockImplementation((_command, options) => {
      const cwd = options?.cwd as string;
      fs.mkdirSync(path.join(cwd, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'pnpm-lock.yaml'), 'generated lockfile');
      return Buffer.alloc(0);
    });

    await expect(executor({ packageJsonDependencySync: 'install' }, createContext(workspaceRoot, appRoot))).resolves.toEqual({
      success: true,
    });

    const packageJson = JSON.parse(fs.readFileSync(appPackageJsonPath, 'utf-8')) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies).toHaveProperty('alpha', '1.0.0');
    expect(fs.existsSync(path.join(appRootPath, 'node_modules'))).toBe(true);
    expect(fs.existsSync(path.join(appRootPath, 'pnpm-lock.yaml'))).toBe(true);
    expect(mockedExecSync).toHaveBeenCalledWith(
      'pnpm install --node-linker=hoisted --ignore-workspace',
      expect.objectContaining({ cwd: appRootPath, stdio: 'inherit' }),
    );
  });

  it('runs install mode even when dependency sync does not change package.json', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace({
      appDependencies: {
        alpha: '1.0.0',
        beta: '2.0.0',
        'cool-package/specific': '2.5.0',
        delta: '4.0.0',
        gamma: '3.0.0',
        transitive: '6.0.0',
      },
    });
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    const originalAppPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');
    tempDirs.push(workspaceRoot);

    await expect(executor({ packageJsonDependencySync: 'install' }, createContext(workspaceRoot, appRoot))).resolves.toEqual({
      success: true,
    });

    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalAppPackageJson);
    expect(mockedExecSync).toHaveBeenCalledWith('npm install', expect.objectContaining({ cwd: appRootPath, stdio: 'inherit' }));
  });

  it('keeps package.json changes and fails when install mode cannot install packages', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace();
    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    tempDirs.push(workspaceRoot);
    mockedExecSync.mockImplementation(() => {
      throw new Error('install failed');
    });

    await expect(executor({ packageJsonDependencySync: 'install' }, createContext(workspaceRoot, appRoot))).rejects.toThrow(
      'install failed',
    );

    const packageJson = JSON.parse(fs.readFileSync(appPackageJsonPath, 'utf-8')) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies).toHaveProperty('alpha', '1.0.0');
  });
});
