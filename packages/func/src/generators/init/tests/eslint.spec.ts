import { Tree, readProjectConfiguration } from '@nx/devkit';
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

describe('Init with no eslint', () => {
  const projectName = 'HelloWorld';
  let appTree: Tree;
  const baseOptions: InitGeneratorSchema = { name: projectName, strict: true, silent: true, tags: '' };

  beforeAll(async () => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  }, TEST_TIMEOUT);

  it(
    'No global config -> no app config',
    async () => {
      await generator(appTree, { ...baseOptions, name: baseOptions.name + '1' });

      const eslintConfigExists = appTree.exists('apps/hello-world1/.eslintrc.json');
      expect(eslintConfigExists).toBeFalsy();
    },
    TEST_TIMEOUT,
  );

  it(
    'Global config exists -> app config generated',
    async () => {
      appTree.write('.eslintrc.json', JSON.stringify({}));
      const name = baseOptions.name + '2';
      await generator(appTree, { ...baseOptions, name });

      const eslintConfigExists = appTree.exists('apps/hello-world2/.eslintrc.json');
      expect(eslintConfigExists).toBeTruthy();

      const projectConfiguration = readProjectConfiguration(appTree, name);
      expect(projectConfiguration).toHaveProperty('targets.lint');
    },
    TEST_TIMEOUT,
  );
});
