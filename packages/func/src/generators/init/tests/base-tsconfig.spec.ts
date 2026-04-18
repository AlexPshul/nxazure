import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from '../generator';
import { InitGeneratorSchema } from '../schema';

jest.mock('@nx/devkit', () => {
  const originalModule = jest.requireActual('@nx/devkit');

  return {
    ...originalModule,
    installPackagesTask: jest.fn(() => console.log('Imagine installing packages here...')),
  };
});

const TEST_TIMEOUT = 120000;

const readBaseCompilerOptions = (tree: Tree) =>
  JSON.parse(tree.read('tsconfig.base.json')?.toString() || '{}').compilerOptions as Record<string, unknown>;

describe('Base tsconfig language/module setup', () => {
  const options: InitGeneratorSchema = { name: 'hello-world', directory: 'apps/hello-world', strict: true, silent: true, tags: '' };

  it(
    'applies the latest variant when the base tsconfig has no module or target configuration',
    async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      tree.write('tsconfig.base.json', JSON.stringify({ compilerOptions: { paths: {} } }));

      await generator(tree, options);

      const compilerOptions = readBaseCompilerOptions(tree);
      expect(compilerOptions).toMatchObject({
        module: 'nodenext',
        moduleDetection: 'force',
        moduleResolution: 'nodenext',
        resolvePackageJsonExports: true,
        resolvePackageJsonImports: true,
        target: 'esnext',
        resolveJsonModule: true,
      });
    },
    TEST_TIMEOUT,
  );

  it(
    'skips preferred defaults when any build-critical option is already set',
    async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      tree.write(
        'tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            module: 'commonjs',
            moduleResolution: 'node',
            target: 'es2022',
            paths: {},
          },
        }),
      );

      await generator(tree, options);

      const compilerOptions = readBaseCompilerOptions(tree);
      expect(compilerOptions.module).toBe('commonjs');
      expect(compilerOptions.moduleResolution).toBe('node');
      expect(compilerOptions.target).toBe('es2022');
      // No preferred defaults should be added when build-critical options exist.
      expect(compilerOptions.moduleDetection).toBeUndefined();
      expect(compilerOptions.resolvePackageJsonExports).toBeUndefined();
      expect(compilerOptions.resolvePackageJsonImports).toBeUndefined();
      // resolveJsonModule is always set regardless.
      expect(compilerOptions.resolveJsonModule).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'skips preferred defaults when only one build-critical option is set',
    async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      tree.write(
        'tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            target: 'es2020',
            paths: {},
          },
        }),
      );

      await generator(tree, options);

      const compilerOptions = readBaseCompilerOptions(tree);
      expect(compilerOptions.target).toBe('es2020');
      expect(compilerOptions.module).toBeUndefined();
      expect(compilerOptions.moduleResolution).toBeUndefined();
      expect(compilerOptions.moduleDetection).toBeUndefined();
      expect(compilerOptions.resolveJsonModule).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
