import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import generator from '../generator';
import { InitGeneratorSchema } from '../schema';

jest.mock('@nrwl/devkit', () => {
  const originalModule = jest.requireActual('@nrwl/devkit');

  return {
    ...originalModule,
    installPackagesTask: jest.fn(() => console.log('Imagine installing packages here...')),
  };
});

describe('Check strict option', () => {
  let appTree: Tree;
  const partialOptions: Omit<InitGeneratorSchema, 'strict'> = { name: 'HelloWorld', silent: true, v4: false };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('Strict option is true', async () => {
    await generator(appTree, { ...partialOptions, strict: true });
    const workspaceTsConfig = appTree.read('apps/hello-world/tsconfig.json');
    const buildTsConfig = appTree.read('apps/hello-world/tsconfig.build.json');

    const workspaceTsConfigObj = JSON.parse(workspaceTsConfig?.toString() || '{}');
    const buildTsConfigObj = JSON.parse(buildTsConfig?.toString() || '{}');

    expect(workspaceTsConfigObj).toHaveProperty('compilerOptions.strict', true);
    expect(buildTsConfigObj).toHaveProperty('compilerOptions.strict', true);
  });

  it('Strict option is false', async () => {
    await generator(appTree, { ...partialOptions, strict: false });
    const workspaceTsConfig = appTree.read('apps/hello-world/tsconfig.json');
    const buildTsConfig = appTree.read('apps/hello-world/tsconfig.build.json');

    const workspaceTsConfigObj = JSON.parse(workspaceTsConfig?.toString() || '{}');
    const buildTsConfigObj = JSON.parse(buildTsConfig?.toString() || '{}');

    expect(workspaceTsConfigObj).toHaveProperty('compilerOptions.strict', false);
    expect(buildTsConfigObj).toHaveProperty('compilerOptions.strict', false);
  });
});
