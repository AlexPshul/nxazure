import { Tree, readProjectConfiguration } from '@nrwl/devkit';
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

describe('Check files (v4)', () => {
  const projectName = 'HelloWorld';
  let appTree: Tree;
  const options: InitGeneratorSchema = { name: projectName, strict: true, silent: true, v4: true };

  beforeAll(async () => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    appTree.write('.eslintrc.json', JSON.stringify({}));
    await generator(appTree, options);
  }, 60000);

  it('Folder name', () => {
    expect(appTree.exists('apps/hello-world')).toBeTruthy();
  });

  it('Project config', () => {
    const config = readProjectConfiguration(appTree, projectName);
    expect(config).toBeDefined();
    expect(config).toHaveProperty('name', projectName);
    expect(config).toHaveProperty('projectType', 'application');
    expect(config).toHaveProperty('targets.build.executor', '@nxazure/func:build');
    expect(config).toHaveProperty('targets.start.executor', '@nxazure/func:start');
    expect(config).toHaveProperty('targets.start.options.port', 7071);
    expect(config).toHaveProperty('targets.publish.executor', '@nxazure/func:publish');
  });

  it('VScode extension', () => {
    const vscodeSettings = appTree.read('.vscode/extensions.json');
    expect(vscodeSettings).toBeDefined();

    const vscodeSettingsObj = JSON.parse(vscodeSettings?.toString() || '{}');
    expect(vscodeSettingsObj.recommendations).toContain('ms-azuretools.vscode-azurefunctions');
  });

  it('Workspace package.json', () => {
    const packageJson = appTree.read('package.json');
    expect(packageJson).toBeDefined();

    const packageJsonObj = JSON.parse(packageJson?.toString() || '{}');
    expect(packageJsonObj).toHaveProperty('dependencies.tsconfig-paths');
    expect(packageJsonObj).toHaveProperty('dependencies.@azure/functions');
    expect(packageJsonObj).toHaveProperty('devDependencies.typescript');
    expect(packageJsonObj).toHaveProperty('devDependencies.azure-functions-core-tools');
    expect(packageJsonObj).toHaveProperty('devDependencies.@types/node');
  });

  it('Workspace TS config file', () => {
    const tsconfig = appTree.read('apps/hello-world/tsconfig.json');
    expect(tsconfig).toBeDefined();

    const tsconfigObj = JSON.parse(tsconfig?.toString() || '{}');
    expect(tsconfigObj).toHaveProperty('extends', '../../tsconfig.base.json');
    expect(tsconfigObj).toHaveProperty('compilerOptions.module', 'commonjs');
    expect(tsconfigObj).toHaveProperty('compilerOptions.target', 'es6');
    expect(tsconfigObj).toHaveProperty('compilerOptions.sourceMap', true);
    expect(tsconfigObj).toHaveProperty('compilerOptions.strict', true);
  });

  it('Build TS config file', () => {
    const tsconfig = appTree.read('apps/hello-world/tsconfig.build.json');
    expect(tsconfig).toBeDefined();

    const tsconfigObj = JSON.parse(tsconfig?.toString() || '{}');
    expect(tsconfigObj).not.toHaveProperty('extends');
    expect(tsconfigObj).toHaveProperty('compilerOptions.outDir', 'dist');
    expect(tsconfigObj).toHaveProperty('compilerOptions.resolveJsonModule', true);
    expect(tsconfigObj).toHaveProperty('compilerOptions.module', 'commonjs');
    expect(tsconfigObj).toHaveProperty('compilerOptions.target', 'es6');
    expect(tsconfigObj).toHaveProperty('compilerOptions.sourceMap', true);
    expect(tsconfigObj).toHaveProperty('compilerOptions.strict', true);
  });

  it('Base TS config file', () => {
    const tsconfig = appTree.read('tsconfig.base.json');
    expect(tsconfig).toBeDefined();

    const tsconfigObj = JSON.parse(tsconfig?.toString() || '{}');
    expect(tsconfigObj).toHaveProperty('compilerOptions.resolveJsonModule', true);
  });

  it('Project eslint config file', () => {
    const eslintConfig = appTree.read('apps/hello-world/.eslintrc.json');
    expect(eslintConfig).toBeDefined();

    const eslintConfigObj = JSON.parse(eslintConfig?.toString() || '{}');
    expect(eslintConfigObj).toHaveProperty('extends', '../../.eslintrc.json');
    expect(eslintConfigObj.overrides[0]).toHaveProperty('parserOptions.project', ['apps/hello-world/tsconfig.*?.json']);
  });

  it('Project package.json file', () => {
    const packageJson = appTree.read('apps/hello-world/package.json');
    expect(packageJson).toBeDefined();

    const packageJsonObj = JSON.parse(packageJson?.toString() || '{}');
    expect(packageJsonObj).toHaveProperty('main', 'dist/src/functions/*.js');
  });

  it('Local settings file', () => {
    const localSettings = appTree.read('apps/hello-world/local.settings.json');
    expect(localSettings).toBeDefined();

    const localSettingsObj = JSON.parse(localSettings?.toString() || '{}');
    expect(localSettingsObj).toHaveProperty('Values.AzureWebJobsFeatureFlags', 'EnableWorkerIndexing');
  });

  it('Auto generated files', () => {
    expect(appTree.exists('apps/hello-world/host.json')).toBeTruthy();
    expect(appTree.exists('apps/hello-world/.funcignore')).toBeTruthy();
    expect(appTree.exists('apps/hello-world/_registerPaths.ts')).toBeTruthy();
  });
});
