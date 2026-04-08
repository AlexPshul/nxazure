import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';
import removePathRegistration from './remove-register-paths';

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

describe('remove-path-registration migration', () => {
  let tree: Tree;
  const projectRoot = 'apps/my-func-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    createFuncProject(tree, 'my-func-app', projectRoot);
  });

  describe('_registerPaths.ts', () => {
    it('should delete _registerPaths.ts', () => {
      tree.write(`${projectRoot}/_registerPaths.ts`, 'import { register } from "tsconfig-paths";');

      removePathRegistration(tree);

      expect(tree.exists(`${projectRoot}/_registerPaths.ts`)).toBe(false);
    });

    it('should remove _registerPaths.ts from eslint ignorePatterns', () => {
      tree.write(`${projectRoot}/_registerPaths.ts`, '');
      tree.write(
        `${projectRoot}/.eslintrc.json`,
        JSON.stringify({ ignorePatterns: ['!**/*', 'dist', 'node_modules', '_registerPaths.ts'] }),
      );

      removePathRegistration(tree);

      const eslint = readJson(tree, `${projectRoot}/.eslintrc.json`);
      expect(eslint.ignorePatterns).toEqual(['!**/*', 'dist', 'node_modules']);
    });

    it('should handle missing _registerPaths.ts gracefully', () => {
      removePathRegistration(tree);

      expect(tree.exists(`${projectRoot}/_registerPaths.ts`)).toBe(false);
    });
  });

  describe('tsconfig-paths dependency', () => {
    it('should remove tsconfig-paths from workspace package.json', () => {
      writeJson(tree, 'package.json', {
        dependencies: { 'tsconfig-paths': '^4.2.0', '@azure/functions': '^4.0.0' },
      });

      removePathRegistration(tree);

      const rootPkg = readJson(tree, 'package.json');
      expect(rootPkg.dependencies['tsconfig-paths']).toBeUndefined();
      expect(rootPkg.dependencies['@azure/functions']).toBe('^4.0.0');
    });

    it('should handle missing tsconfig-paths gracefully', () => {
      writeJson(tree, 'package.json', { dependencies: { '@azure/functions': '^4.0.0' } });

      removePathRegistration(tree);

      const rootPkg = readJson(tree, 'package.json');
      expect(rootPkg.dependencies['@azure/functions']).toBe('^4.0.0');
    });
  });

  it('should produce the same result when run twice', () => {
    tree.write(`${projectRoot}/_registerPaths.ts`, '');
    tree.write(`${projectRoot}/.eslintrc.json`, JSON.stringify({ ignorePatterns: ['!**/*', 'dist', 'node_modules', '_registerPaths.ts'] }));
    writeJson(tree, 'package.json', {
      dependencies: { 'tsconfig-paths': '^4.2.0', '@azure/functions': '^4.0.0' },
    });

    removePathRegistration(tree);
    const firstPassEslint = readJson(tree, `${projectRoot}/.eslintrc.json`);
    const firstPassPkg = readJson(tree, 'package.json');

    removePathRegistration(tree);
    const secondPassEslint = readJson(tree, `${projectRoot}/.eslintrc.json`);
    const secondPassPkg = readJson(tree, 'package.json');

    expect(secondPassEslint).toEqual(firstPassEslint);
    expect(secondPassPkg).toEqual(firstPassPkg);
  });
});
