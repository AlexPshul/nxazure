import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FsTree } from 'nx/src/generators/tree';
import { FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';
import cleanAppPackageJson from './clean-app-package-json';

const writeFileToDisk = (root: string, relativePath: string, content: string) => {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
};

const defaultTsConfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Node',
    outDir: 'dist',
    skipLibCheck: true,
    esModuleInterop: true,
  },
  include: ['src/**/*.ts'],
  exclude: ['**/*.spec.ts', '**/*.test.ts'],
};

const createFuncProject = (tree: Tree, name: string, root: string) => {
  addProjectConfiguration(tree, name, {
    root,
    name,
    projectType: 'application',
    targets: {
      build: { executor: `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:build` },
    },
  });
};

describe('clean-app-package-json migration', () => {
  let tmpDir: string;
  let tree: Tree;
  const projectRoot = 'apps/my-func-app';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxazure-test-'));
    tree = new FsTree(tmpDir, false);
    writeFileToDisk(tmpDir, 'nx.json', JSON.stringify({}));

    createFuncProject(tree, 'my-func-app', projectRoot);
    writeFileToDisk(tmpDir, `${projectRoot}/tsconfig.json`, JSON.stringify(defaultTsConfig));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should remove dependencies that are imported from source code', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/functions/hello.ts`, `import { app } from '@azure/functions';\napp.http('hello', {});`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { '@azure/functions': '^4.0.0', 'some-peer-dep': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['@azure/functions']).toBeUndefined();
    expect(pkg.dependencies['some-peer-dep']).toBe('^1.0.0');
  });

  it('should handle scoped packages with sub-paths', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `import { something } from '@azure/functions/app';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { '@azure/functions': '^4.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['@azure/functions']).toBeUndefined();
  });

  it('should handle require calls', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/utils.ts`, `const pkg = require('some-lib');`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'some-lib': '^2.0.0', 'manual-dep': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['some-lib']).toBeUndefined();
    expect(pkg.dependencies['manual-dep']).toBe('^1.0.0');
  });

  it('should handle re-exports', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `export { handler } from 'some-lib';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'some-lib': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['some-lib']).toBeUndefined();
  });

  it('should not remove packages that are not imported', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `import { app } from '@azure/functions';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { '@azure/functions': '^4.0.0', 'peer-only': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['peer-only']).toBe('^1.0.0');
  });

  it('should skip spec and test files when excluded by tsconfig', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `export const x = 1;`);
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.spec.ts`, `import { testHelper } from 'test-lib';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'test-lib': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['test-lib']).toBe('^1.0.0');
  });

  it('should add type: module to package.json', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, '');
    writeJson(tree, `${projectRoot}/package.json`, { name: 'my-func-app' });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.type).toBe('module');
  });

  it('should warn when package.json is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    cleanAppPackageJson(tree);

    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("won't be publishable to Azure natively"));

    warnSpy.mockRestore();
  });

  it('should resolve unscoped deep sub-path imports to the longest matching dependency', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `import { thing } from 'cool/package/name/with/inner/import';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'cool/package': '^1.0.0', unrelated: '^2.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['cool/package']).toBeUndefined();
    expect(pkg.dependencies['unrelated']).toBe('^2.0.0');
  });

  it('should handle dynamic imports', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `const mod = import('dynamic-lib');`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'dynamic-lib': '^3.0.0', 'manual-dep': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['dynamic-lib']).toBeUndefined();
    expect(pkg.dependencies['manual-dep']).toBe('^1.0.0');
  });

  it('should produce the same result when run twice', () => {
    writeFileToDisk(tmpDir, `${projectRoot}/src/functions/hello.ts`, `import { app } from '@azure/functions';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { '@azure/functions': '^4.0.0', 'peer-dep': '^1.0.0' },
    });

    cleanAppPackageJson(tree);
    const firstPass = readJson(tree, `${projectRoot}/package.json`);

    cleanAppPackageJson(tree);
    const secondPass = readJson(tree, `${projectRoot}/package.json`);

    expect(secondPass).toEqual(firstPass);
  });

  it('should remove transitive dependencies imported through workspace libraries', () => {
    const libRoot = 'libs/shared-lib';

    writeFileToDisk(tmpDir, `${libRoot}/src/index.ts`, `import axios from 'axios';\nexport const fetch = axios.get;`);
    writeFileToDisk(tmpDir, `${projectRoot}/src/index.ts`, `import { fetch } from '@myorg/shared-lib';`);
    writeFileToDisk(
      tmpDir,
      `${projectRoot}/tsconfig.json`,
      JSON.stringify({
        ...defaultTsConfig,
        compilerOptions: {
          ...defaultTsConfig.compilerOptions,
          baseUrl: '../..',
          paths: { '@myorg/shared-lib': ['libs/shared-lib/src/index.ts'] },
        },
      }),
    );
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { axios: '^1.7.0', 'peer-only': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['axios']).toBeUndefined();
    expect(pkg.dependencies['peer-only']).toBe('^1.0.0');
  });
});
