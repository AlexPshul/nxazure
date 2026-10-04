import { detectPackageManager } from '@nx/devkit';
import { readJson, runCommandAsync, tmpProjPath, uniq, updateFile } from '@nx/plugin/testing';
import fs from 'fs';
import path from 'path';
import { checkTheThing, type PreparedFunctionApp } from '../utils/function-app';
import { resetWorkspace, setupWorkspace } from '../utils/workspace';

const TEST_TIMEOUT = 180000;
const workspaceSettings = ['allowBuilds:', '  nx: true', '  protobufjs: false', ''].join('\n');

const setupPnpmWorkspace = async () => {
  process.env.PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN = 'false';
  updateFile('pnpm-workspace.yaml', workspaceSettings);
  await runCommandAsync('pnpm install --no-frozen-lockfile');
};

const setInstallMode = (directory: string) => {
  const projectJsonPath = `${directory}/project.json`;
  const projectConfig = readJson<Record<string, unknown>>(projectJsonPath) as {
    targets: { build: { options?: Record<string, unknown> } };
  };
  projectConfig.targets.build.options ??= {};
  projectConfig.targets.build.options.packageJsonDependencySync = 'install';
  updateFile(projectJsonPath, JSON.stringify(projectConfig, null, 2));
};

const preparePnpmBuild = async ({ directory, funcFilePath }: PreparedFunctionApp) => {
  updateFile(funcFilePath, content => {
    const returnStatement = '  return { body:';
    if (!content.includes(returnStatement)) throw new Error(`Could not find hello handler in ${funcFilePath}.`);

    return `import { loadSync } from '@grpc/proto-loader';\n${content.replace(returnStatement, '  return { body: typeof loadSync +')}`;
  });

  const packageJson = readJson<Record<string, unknown>>('package.json') as {
    dependencies?: Record<string, string>;
  };
  packageJson.dependencies = {
    ...packageJson.dependencies,
    '@grpc/proto-loader': '0.8.1', // This is an example for a package that will break the pnpm install path if not handled properly
  };

  updateFile('package.json', JSON.stringify(packageJson, null, 2));
  await runCommandAsync('pnpm install --no-frozen-lockfile');

  setInstallMode(directory);
};

const preparePnpmBuildWithImport =
  (packageName: string, exportName: string) =>
  async ({ directory, funcFilePath }: PreparedFunctionApp) => {
    updateFile(funcFilePath, content => {
      const returnStatement = '  return { body:';
      if (!content.includes(returnStatement)) throw new Error(`Could not find hello handler in ${funcFilePath}.`);

      return `import { ${exportName} } from '${packageName}';\n${content.replace(returnStatement, `  return { body: typeof ${exportName} +`)}`;
    });
    setInstallMode(directory);
  };

describe('PNPM workspaces', () => {
  beforeAll(async () => {
    await setupWorkspace();
    await setupPnpmWorkspace();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await resetWorkspace();
  }, TEST_TIMEOUT);

  it(
    'builds and installs function dependencies while respecting workspace build decisions',
    async () => {
      const project = uniq('func');
      const directory = `apps/${project}`;
      expect(detectPackageManager(tmpProjPath())).toBe('pnpm');
      expect(fs.existsSync(tmpProjPath('pnpm-lock.yaml'))).toBe(true);
      expect(fs.readFileSync(tmpProjPath('pnpm-workspace.yaml'), 'utf-8')).toBe(workspaceSettings);

      await checkTheThing(project, directory, { beforeBuild: preparePnpmBuild });
      const projectRoot = tmpProjPath(directory);

      expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'src', 'functions', 'hello.js'))).toBe(true);

      expect(fs.existsSync(path.join(projectRoot, 'node_modules', '@grpc', 'proto-loader', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'node_modules', 'protobufjs', 'package.json'))).toBe(true);
      expect(fs.readFileSync(tmpProjPath('pnpm-workspace.yaml'), 'utf-8')).toBe(workspaceSettings);
    },
    TEST_TIMEOUT,
  );

  it(
    'installs only each function app dependency from the shared workspace manifest',
    async () => {
      const firstProject = uniq('firstfunc');
      const secondProject = uniq('secondfunc');
      const firstDirectory = `apps/${firstProject}`;
      const secondDirectory = `apps/${secondProject}`;
      const packageJson = readJson<Record<string, unknown>>('package.json') as { dependencies?: Record<string, string> };
      packageJson.dependencies = { ...packageJson.dependencies, zod: '3.25.76', yaml: '2.9.0' };
      updateFile('package.json', JSON.stringify(packageJson, null, 2));
      await runCommandAsync('pnpm install --no-frozen-lockfile');

      await checkTheThing(firstProject, firstDirectory, { beforeBuild: preparePnpmBuildWithImport('zod', 'z') });
      await checkTheThing(secondProject, secondDirectory, { beforeBuild: preparePnpmBuildWithImport('yaml', 'parse') });

      const firstDependencies = readJson<{ dependencies: Record<string, string> }>(`${firstDirectory}/package.json`).dependencies;
      const secondDependencies = readJson<{ dependencies: Record<string, string> }>(`${secondDirectory}/package.json`).dependencies;
      const firstAppRoot = tmpProjPath(firstDirectory);
      const secondAppRoot = tmpProjPath(secondDirectory);

      expect(readJson<{ dependencies: Record<string, string> }>('package.json').dependencies).toMatchObject({
        zod: '3.25.76',
        yaml: '2.9.0',
      });
      expect(firstDependencies).toHaveProperty('zod', '3.25.76');
      expect(firstDependencies).not.toHaveProperty('yaml');
      expect(secondDependencies).toHaveProperty('yaml', '2.9.0');
      expect(secondDependencies).not.toHaveProperty('zod');
      expect(fs.existsSync(path.join(firstAppRoot, 'node_modules', 'zod', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(firstAppRoot, 'node_modules', 'yaml', 'package.json'))).toBe(false);
      expect(fs.existsSync(path.join(secondAppRoot, 'node_modules', 'yaml', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(secondAppRoot, 'node_modules', 'zod', 'package.json'))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
