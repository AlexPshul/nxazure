import { Tree, getProjects, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from '../../generators/init/generator';
import { InitGeneratorSchema } from '../../generators/init/schema';
import updateEslintConfig from './update-eslint-config';

jest.mock('@nx/devkit', () => {
  const originalModule = jest.requireActual('@nx/devkit');

  return {
    ...originalModule,
    installPackagesTask: jest.fn(() => console.log('Imagine installing packages here...')),
  };
});

const TEST_TIMEOUT = 120000;

describe('update-eslint-config migration', () => {
  const projectName = 'test-eslint-update';
  let appTree: Tree;
  const options: InitGeneratorSchema = { name: projectName, directory: 'apps/test-eslint-update', strict: true, silent: true, tags: '' };

  beforeAll(async () => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    appTree.write('.eslintrc.json', JSON.stringify({}));
    await generator(appTree, options);

    // simulate the migration
    updateEslintConfig(appTree);
  }, TEST_TIMEOUT);

  it('should add ignorePatterns to .eslintrc.json', () => {
    const projectFound = Array.from(getProjects(appTree)).find(([name]) => name === projectName);
    expect(projectFound).toBeDefined();

    const [, project] = projectFound;
    const { ignorePatterns } = readJson<{ ignorePatterns: string[] }>(appTree, `${project.root}/.eslintrc.json`);
    expect(ignorePatterns).toEqual(['!**/*', 'dist', 'node_modules', '_registerPaths.ts']);
  });
});
