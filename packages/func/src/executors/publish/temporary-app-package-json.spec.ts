import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTemporaryAppPackageJsonManager } from './temporary-app-package-json';

const createWorkspace = (workspacePackageJson: object, appPackageJson: object) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nxazure-func-temp-package-json-'));
  const appRoot = path.join(workspaceRoot, 'apps', 'demo-app');

  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify(workspacePackageJson, null, 2));
  fs.writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify(appPackageJson, null, 2));

  return {
    workspaceRoot,
    appRoot,
    appPackageJsonPath: path.join(appRoot, 'package.json'),
  };
};

describe('temporary app package.json manager', () => {
  const tempDirs: string[] = [];
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    tempDirs.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it('adds missing runtime dependencies, resolves longest matching workspace dependency keys, and restores the original manifest', () => {
    const { workspaceRoot, appRoot, appPackageJsonPath } = createWorkspace(
      {
        name: 'workspace',
        version: '1.0.0',
        dependencies: {
          alpha: '1.0.0',
          beta: '2.0.0',
          'cool-package/specific': '2.5.0',
          gamma: '3.0.0',
        },
      },
      {
        name: 'demo-app',
        version: '1.0.0',
        dependencies: {
          beta: '22.22.22',
          'manual-only': '8.8.8',
        },
      },
    );
    tempDirs.push(workspaceRoot);
    const originalAppPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');

    const manager = createTemporaryAppPackageJsonManager(workspaceRoot, appRoot, [
      'alpha',
      'beta/subpath',
      'cool-package/specific/sub-path',
      'gamma/internal',
      'unknown-package/entry',
      'alpha',
    ]);

    expect(manager.apply()).toBe(true);

    const temporaryPackageJson = JSON.parse(fs.readFileSync(appPackageJsonPath, 'utf-8')) as {
      dependencies: Record<string, string>;
    };

    expect(temporaryPackageJson.dependencies).toEqual({
      alpha: '1.0.0',
      beta: '22.22.22',
      'cool-package/specific': '2.5.0',
      gamma: '3.0.0',
      'manual-only': '8.8.8',
    });

    manager.restore();

    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalAppPackageJson);
  });

  it('returns a no-op when nothing needs to be added', () => {
    const { workspaceRoot, appRoot, appPackageJsonPath } = createWorkspace(
      {
        name: 'workspace',
        version: '1.0.0',
        dependencies: {
          alpha: '1.0.0',
        },
      },
      {
        name: 'demo-app',
        version: '1.0.0',
        dependencies: {
          alpha: '9.9.9',
        },
      },
    );
    tempDirs.push(workspaceRoot);
    const originalAppPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');

    const manager = createTemporaryAppPackageJsonManager(workspaceRoot, appRoot, ['alpha', 'missing-package/sub-path']);

    expect(manager.apply()).toBe(false);

    manager.restore();

    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalAppPackageJson);
  });
});
