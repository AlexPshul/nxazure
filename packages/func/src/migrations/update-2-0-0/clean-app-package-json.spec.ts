import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';
import cleanAppPackageJson from './clean-app-package-json';

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
  let tree: Tree;
  const projectRoot = 'apps/my-func-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    createFuncProject(tree, 'my-func-app', projectRoot);
  });

  it('should remove dependencies that are imported from source code', () => {
    tree.write(`${projectRoot}/src/functions/hello.ts`, `import { app } from '@azure/functions';\napp.http('hello', {});`);
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
    tree.write(`${projectRoot}/src/index.ts`, `import { something } from '@azure/functions/app';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { '@azure/functions': '^4.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['@azure/functions']).toBeUndefined();
  });

  it('should handle require calls', () => {
    tree.write(`${projectRoot}/src/utils.ts`, `const pkg = require('some-lib');`);
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
    tree.write(`${projectRoot}/src/index.ts`, `export { handler } from 'some-lib';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'some-lib': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['some-lib']).toBeUndefined();
  });

  it('should not remove packages that are not imported', () => {
    tree.write(`${projectRoot}/src/index.ts`, `import { app } from '@azure/functions';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { '@azure/functions': '^4.0.0', 'peer-only': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['peer-only']).toBe('^1.0.0');
  });

  it('should skip spec and test files', () => {
    tree.write(`${projectRoot}/src/index.spec.ts`, `import { testHelper } from 'test-lib';`);
    writeJson(tree, `${projectRoot}/package.json`, {
      name: 'my-func-app',
      dependencies: { 'test-lib': '^1.0.0' },
    });

    cleanAppPackageJson(tree);

    const pkg = readJson(tree, `${projectRoot}/package.json`);
    expect(pkg.dependencies['test-lib']).toBe('^1.0.0');
  });

  it('should add type: module to package.json', () => {
    tree.write(`${projectRoot}/src/index.ts`, '');
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
    tree.write(`${projectRoot}/src/index.ts`, `import { thing } from 'cool/package/name/with/inner/import';`);
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
    tree.write(`${projectRoot}/src/index.ts`, `const mod = import('dynamic-lib');`);
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
    tree.write(`${projectRoot}/src/functions/hello.ts`, `import { app } from '@azure/functions';`);
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
});
