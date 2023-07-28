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

describe.each([
  {
    name: 'HelloWorld',
    path: 'apps/hello-world',
    sublevelFromRoot: 2
  },
  {
    name: 'core/HelloWorld',
    path: 'apps/core/hello-world',
    sublevelFromRoot: 3
  }
])
('Check files (v4)', (testArgs: { name: string, path: string, sublevelFromRoot: number }) => {
  const projectName = testArgs.name;
  let appTree: Tree;
  const options: InitGeneratorSchema = { name: projectName, strict: true, silent: true, v4: true };

  beforeAll(async () => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    appTree.write('.eslintrc.json', JSON.stringify({}));
    await generator(appTree, options);
  }, 120000);

  it('Folder name', () => {
    expect(appTree.exists(testArgs.path)).toBeTruthy();
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
    const tsconfig = appTree.read(`${testArgs.path}/tsconfig.json`);
    expect(tsconfig).toBeDefined();

    const tsconfigObj = JSON.parse(tsconfig?.toString() || '{}');
    expect(tsconfigObj).toHaveProperty('extends', `${'../'.repeat(testArgs.sublevelFromRoot)}tsconfig.base.json`);
    expect(tsconfigObj).toHaveProperty('compilerOptions.module', 'commonjs');
    expect(tsconfigObj).toHaveProperty('compilerOptions.target', 'es6');
    expect(tsconfigObj).toHaveProperty('compilerOptions.sourceMap', true);
    expect(tsconfigObj).toHaveProperty('compilerOptions.strict', true);
  });

  it('Build TS config file', () => {
    const tsconfig = appTree.read(`${testArgs.path}/tsconfig.build.json`);
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
    const eslintConfig = appTree.read(`${testArgs.path}/.eslintrc.json`);
    expect(eslintConfig).toBeDefined();

    const eslintConfigObj = JSON.parse(eslintConfig?.toString() || '{}');
    expect(eslintConfigObj).toHaveProperty('extends', `${'../'.repeat(testArgs.sublevelFromRoot)}.eslintrc.json`);
    expect(eslintConfigObj.overrides[0]).toHaveProperty('parserOptions.project', [`${testArgs.path}/tsconfig.*?.json`]);
  });

  it('Project package.json file', () => {
    const packageJson = appTree.read(`${testArgs.path}/package.json`);
    expect(packageJson).toBeDefined();

    const packageJsonObj = JSON.parse(packageJson?.toString() || '{}');
    expect(packageJsonObj).toHaveProperty('main', `dist/${testArgs.path}/src/functions/*.js`);
  });

  it('Local settings file', () => {
    const localSettings = appTree.read(`${testArgs.path}/local.settings.json`);
    expect(localSettings).toBeDefined();

    const localSettingsObj = JSON.parse(localSettings?.toString() || '{}');
    expect(localSettingsObj).toHaveProperty('Values.AzureWebJobsFeatureFlags', 'EnableWorkerIndexing');
  });

  it('Auto generated files', () => {
    expect(appTree.exists(`${testArgs.path}/host.json`)).toBeTruthy();
    expect(appTree.exists(`${testArgs.path}/.funcignore`)).toBeTruthy();
    expect(appTree.exists(`${testArgs.path}/_registerPaths.ts`)).toBeTruthy();
  });
});
