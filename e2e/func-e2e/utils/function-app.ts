import { detectPackageManager, getPackageManagerCommand } from '@nx/devkit';
import { readJson, runCommandAsync, runNxCommandAsync, tmpProjPath, updateFile } from '@nx/plugin/testing';
import fs from 'fs';
import path from 'path';
import { lib1 } from './workspace';

export type PreparedFunctionApp = {
  directory: string;
  funcFilePath: string;
  project: string;
};

type TsConfigMutator = (tsconfig: { compilerOptions?: Record<string, unknown> }) => void;

type CheckFunctionAppOptions = {
  beforeBuild?: (app: PreparedFunctionApp) => Promise<void>;
  mutateTsConfig?: TsConfigMutator;
};

const removeWorkspaceDevDependency = (dependencyName: string) => {
  const workspacePackageJson = readJson<Record<string, unknown>>('package.json') as {
    devDependencies?: Record<string, string>;
  };

  delete workspacePackageJson.devDependencies?.[dependencyName];
  updateFile('package.json', JSON.stringify(workspacePackageJson, null, 2));
};

export const prepareFunctionApp = async (project: string, directory: string): Promise<PreparedFunctionApp> => {
  const func = 'hello';

  await runNxCommandAsync(`g @nxazure/func:init ${project} --directory=${directory}`);
  await runNxCommandAsync(`g @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
  removeWorkspaceDevDependency('azure-functions-core-tools');
  const packageManager = detectPackageManager(tmpProjPath());
  await runCommandAsync(getPackageManagerCommand(packageManager, tmpProjPath()).install);

  return { directory, funcFilePath: `${directory}/src/functions/${func}.ts`, project };
};

const updateProjectTsConfig = (directory: string, mutateTsConfig: TsConfigMutator) => {
  const tsconfigPath = `${directory}/tsconfig.json`;
  const tsconfig = readJson<Record<string, unknown>>(tsconfigPath) as {
    compilerOptions?: Record<string, unknown>;
  };

  mutateTsConfig(tsconfig);
  updateFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
};

const addFunctionAppContent = ({ directory, funcFilePath }: PreparedFunctionApp) => {
  updateFile(
    funcFilePath,
    `
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ${lib1} } from "@proj/${lib1}";

export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const name = request.query.get('name') || await request.text() || 'world';

  return { body: ${lib1}() };
};

app.http('hello', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: hello
});
  `,
  );

  const projectJsonPath = `${directory}/project.json`;
  const projectConfig = readJson<Record<string, unknown>>(projectJsonPath) as {
    targets: { build: { options?: Record<string, unknown> } };
  };

  projectConfig.targets.build.options ??= {};
  projectConfig.targets.build.options.assets = [
    `README.md`,
    `${directory}/prompts/**/*.md`,
    {
      input: `${directory}/static`,
      glob: '**/*.json',
      output: 'static-assets',
    },
    {
      input: `${directory}/scoped-static`,
      glob: '**/*.json',
      output: `${directory}/static-assets`,
    },
  ];

  updateFile(projectJsonPath, JSON.stringify(projectConfig, null, 2));

  const projectRoot = tmpProjPath(directory);

  fs.mkdirSync(path.join(projectRoot, 'prompts', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'static', 'configs'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'scoped-static', 'configs'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'prompts', 'welcome.md'), 'prompt root');
  fs.writeFileSync(path.join(projectRoot, 'prompts', 'nested', 'follow-up.md'), 'prompt nested');
  fs.writeFileSync(path.join(projectRoot, 'static', 'app.json'), '{"name":"func"}');
  fs.writeFileSync(path.join(projectRoot, 'static', 'configs', 'env.json'), '{"env":"test"}');
  fs.writeFileSync(path.join(projectRoot, 'scoped-static', 'app.json'), '{"name":"func-scoped"}');
  fs.writeFileSync(path.join(projectRoot, 'scoped-static', 'configs', 'env.json'), '{"env":"scoped-test"}');
};

const assertFunctionAppBuild = async ({ directory, project }: PreparedFunctionApp) => {
  const projectRoot = tmpProjPath(directory);

  console.log('Running build...');
  try {
    const buildResult = await runNxCommandAsync(`build ${project}`);
    if (buildResult.stderr) console.error('Error: ', buildResult.stderr);

    expect(buildResult.stdout).toContain(`<⚡> ["${project}"] Build is ready.`);
    expect(fs.existsSync(path.join(projectRoot, 'dist', 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'prompts', 'welcome.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'prompts', 'nested', 'follow-up.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', 'static-assets', 'app.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', 'static-assets', 'configs', 'env.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'static-assets', 'app.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'static-assets', 'configs', 'env.json'))).toBe(true);
  } catch (e) {
    console.error('Build failed with error: ', e);
    throw e;
  }
};

export const checkTheThing = async (
  project: string,
  directory: string,
  { beforeBuild, mutateTsConfig }: CheckFunctionAppOptions = {},
): Promise<PreparedFunctionApp> => {
  const preparedFunctionApp = await prepareFunctionApp(project, directory);
  if (mutateTsConfig) updateProjectTsConfig(directory, mutateTsConfig);
  addFunctionAppContent(preparedFunctionApp);
  if (beforeBuild) await beforeBuild(preparedFunctionApp);
  await assertFunctionAppBuild(preparedFunctionApp);

  return preparedFunctionApp;
};
