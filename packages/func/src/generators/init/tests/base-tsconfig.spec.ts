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
    'preserves existing language/module settings already present in the base tsconfig',
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
      // Missing options should still be filled in from the latest defaults.
      expect(compilerOptions.moduleDetection).toBe('force');
      expect(compilerOptions.resolvePackageJsonExports).toBe(true);
      expect(compilerOptions.resolvePackageJsonImports).toBe(true);
      expect(compilerOptions.resolveJsonModule).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
