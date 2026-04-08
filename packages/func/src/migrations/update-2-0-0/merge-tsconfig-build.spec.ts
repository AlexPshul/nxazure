import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';
import mergeTsconfigBuild from './merge-tsconfig-build';

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

describe('merge-tsconfig-build migration', () => {
  let tree: Tree;
  const projectRoot = 'apps/my-func-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    createFuncProject(tree, 'my-func-app', projectRoot);
  });

  it('should merge unique options from tsconfig.build.json into tsconfig.json', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ extends: '../../tsconfig.base.json', compilerOptions: { strict: true } }));
    tree.write(
      `${projectRoot}/tsconfig.build.json`,
      JSON.stringify({ compilerOptions: { strict: true, resolveJsonModule: true, sourceMap: true, outDir: 'dist' } }),
    );

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.resolveJsonModule).toBe(true);
    expect(tsconfig.compilerOptions.sourceMap).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBe('dist');
    expect(tree.exists(`${projectRoot}/tsconfig.build.json`)).toBe(false);
  });

  it('should overwrite tsconfig.json options with tsconfig.build.json values', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ compilerOptions: { strict: false, outDir: 'custom-dist' } }));
    tree.write(`${projectRoot}/tsconfig.build.json`, JSON.stringify({ compilerOptions: { strict: true, outDir: 'dist' } }));

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBe('dist');
  });

  it('should skip build-managed options', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ compilerOptions: {} }));
    tree.write(
      `${projectRoot}/tsconfig.build.json`,
      JSON.stringify({ compilerOptions: { noEmitOnError: false, rootDir: 'src', tsBuildInfoFile: 'build.info' } }),
    );

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.compilerOptions.noEmitOnError).toBeUndefined();
    expect(tsconfig.compilerOptions.rootDir).toBeUndefined();
    expect(tsconfig.compilerOptions.tsBuildInfoFile).toBeUndefined();
  });

  it('should set outDir to dist if missing from both files', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ compilerOptions: { strict: true } }));

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.compilerOptions.outDir).toBe('dist');
  });

  it('should handle missing tsconfig.build.json gracefully', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ compilerOptions: { strict: true } }));

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBe('dist');
  });

  it('should merge top-level fields (include, exclude) from tsconfig.build.json when missing from tsconfig.json', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ compilerOptions: { strict: true } }));
    tree.write(
      `${projectRoot}/tsconfig.build.json`,
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { outDir: 'dist' },
        exclude: ['**/*.spec.ts', 'src/__mocks__'],
      }),
    );

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.exclude).toEqual(['**/*.spec.ts', 'src/__mocks__']);
    expect(tsconfig.extends).toBeUndefined();
  });

  it('should overwrite existing top-level fields in tsconfig.json with build config values', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ compilerOptions: {}, exclude: ['node_modules'] }));
    tree.write(`${projectRoot}/tsconfig.build.json`, JSON.stringify({ compilerOptions: {}, exclude: ['**/*.spec.ts'] }));

    mergeTsconfigBuild(tree);

    const tsconfig = readJson(tree, `${projectRoot}/tsconfig.json`);
    expect(tsconfig.exclude).toEqual(['**/*.spec.ts']);
  });

  it('should warn and skip when tsconfig.json is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    tree.write(`${projectRoot}/tsconfig.build.json`, JSON.stringify({ compilerOptions: { outDir: 'dist' } }));

    mergeTsconfigBuild(tree);

    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('tsconfig.json'));
    expect(tree.exists(`${projectRoot}/tsconfig.build.json`)).toBe(true);
    warnSpy.mockRestore();
  });

  it('should produce the same result when run twice', () => {
    tree.write(`${projectRoot}/tsconfig.json`, JSON.stringify({ extends: '../../tsconfig.base.json', compilerOptions: { strict: true } }));
    tree.write(`${projectRoot}/tsconfig.build.json`, JSON.stringify({ compilerOptions: { resolveJsonModule: true, outDir: 'dist' } }));

    mergeTsconfigBuild(tree);
    const firstPass = readJson(tree, `${projectRoot}/tsconfig.json`);

    mergeTsconfigBuild(tree);
    const secondPass = readJson(tree, `${projectRoot}/tsconfig.json`);

    expect(secondPass).toEqual(firstPass);
  });
});
