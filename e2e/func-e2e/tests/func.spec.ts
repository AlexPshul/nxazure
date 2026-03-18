import { NxJsonConfiguration } from '@nx/devkit';
import fs from 'fs';
import path from 'path';
import {
  ensureNxProject,
  readJson,
  runCommand,
  runCommandAsync,
  runNxCommandAsync,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/plugin/testing';

const lib1 = 'lvl1lib';
const lib2 = 'lvl2lib';

describe('Project initialization and build', () => {
  const TEST_TIMEOUT = 180000;
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(async () => {
    process.env.NX_DAEMON = 'false';

    console.log('Before all');
    ensureNxProject('@nxazure/func', 'dist/packages/func');
    console.log('After ensureNxProject');

    const nxConfig = readJson<NxJsonConfiguration>('nx.json');
    nxConfig.workspaceLayout = { appsDir: 'apps', libsDir: 'libs' };

    updateFile('nx.json', JSON.stringify(nxConfig, null, 2));

    console.log('Installing types');
    runCommand('npm i @types/node@latest', {});

    console.log('Generating libraries');
    await runNxCommandAsync(`g @nx/js:library ${lib1} --directory=libs/${lib1} --bundler=none --linter=none --unitTestRunner=none`);
    await runNxCommandAsync(`g @nx/js:library ${lib2} --directory=libs/${lib2} --bundler=none --linter=none --unitTestRunner=none`);

    const libFilePath = `libs/${lib1}/src/lib/${lib1}.ts`;
    updateFile(
      libFilePath,
      `
import { ${lib2} } from '@proj/${lib2}';

export function ${lib1}(): string {
return ${lib2}();
}
      `,
    );
    console.log('Generated the libs and ready to test');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    await runNxCommandAsync('reset');
  }, TEST_TIMEOUT);

  const checkTheThing = async (project: string, directory: string) => {
    const func = 'hello';
    const projectRoot = tmpProjPath(directory);

    await runNxCommandAsync(`g @nxazure/func:init ${project} --directory=${directory}`);
    await runNxCommandAsync(`g @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
    await runCommandAsync('npm i');

    const funcFilePath = `${directory}/src/functions/${func}.ts`;

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
      `${directory}/README.md`,
      `${directory}/prompts/**/*.md`,
      {
        input: `${directory}/static`,
        glob: '**/*.json',
        output: 'static-assets',
      },
    ];

    updateFile(projectJsonPath, JSON.stringify(projectConfig, null, 2));

    fs.mkdirSync(path.join(projectRoot, 'prompts', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'static', 'configs'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Asset copy');
    fs.writeFileSync(path.join(projectRoot, 'prompts', 'welcome.md'), 'prompt root');
    fs.writeFileSync(path.join(projectRoot, 'prompts', 'nested', 'follow-up.md'), 'prompt nested');
    fs.writeFileSync(path.join(projectRoot, 'static', 'app.json'), '{"name":"func"}');
    fs.writeFileSync(path.join(projectRoot, 'static', 'configs', 'env.json'), '{"env":"test"}');

    console.log('Running build...');
    try {
      const buildResult = await runNxCommandAsync(`build ${project}`);
      if (buildResult.stderr) console.error('Error: ', buildResult.stderr);

      expect(buildResult.stdout).toContain(`<⚡> Azure Functions build is ready for project "${project}".`);
      expect(fs.existsSync(path.join(projectRoot, 'dist', 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'dist', 'prompts', 'welcome.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'dist', 'prompts', 'nested', 'follow-up.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'dist', 'static-assets', 'app.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'dist', 'static-assets', 'configs', 'env.json'))).toBe(true);
    } catch (e) {
      console.error('Build failed with error: ', e);
      throw e;
    }
  };

  it(
    'should init & build a workspace with a js lib and, a functions app and a function that uses that lib',
    async () => {
      const project = uniq('func');
      const directory = `apps/${project}`;

      console.log('Checking test 1');
      await checkTheThing(project, directory);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a js lib, a nested functions app (apps/test/my-app) and a function that uses that lib',
    async () => {
      const project = `${uniq('func')}`;
      const directory = `apps/sub-app/${project}`;

      console.log('Checking test 2');
      await checkTheThing(project, directory);
    },
    TEST_TIMEOUT,
  );

  it(
    'should show a readable error when assets are configured and @nx/js is missing',
    async () => {
      const project = uniq('func');
      const directory = `apps/${project}`;
      const projectRoot = tmpProjPath(directory);

      await runNxCommandAsync(`g @nxazure/func:init ${project} --directory=${directory}`);

      const projectJsonPath = `${directory}/project.json`;
      const projectConfig = readJson<Record<string, unknown>>(projectJsonPath) as {
        targets: { build: { options?: Record<string, unknown> } };
      };

      projectConfig.targets.build.options ??= {};
      projectConfig.targets.build.options.assets = [`${directory}/README.md`];
      updateFile(projectJsonPath, JSON.stringify(projectConfig, null, 2));
      fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Missing peer');

      const nxJsPath = tmpProjPath(path.join('node_modules', '@nx', 'js'));
      const nxJsBackupPath = tmpProjPath(path.join('node_modules', '@nx', 'js.bak'));
      const repoNxJsPath = path.join(process.cwd(), 'node_modules', '@nx', 'js');
      const repoNxJsBackupPath = path.join(process.cwd(), 'node_modules', '@nx', 'js.bak');

      fs.renameSync(nxJsPath, nxJsBackupPath);
      fs.renameSync(repoNxJsPath, repoNxJsBackupPath);

      try {
        const buildResult = await runNxCommandAsync(`build ${project}`, { silenceError: true });
        const output = `${buildResult.stdout}\n${buildResult.stderr}`;
        expect(output).toContain('Asset copying for @nxazure/func requires the optional peer dependency "@nx/js"');
        expect(output).toContain('npm install -D @nx/js');
      } finally {
        fs.renameSync(nxJsBackupPath, nxJsPath);
        fs.renameSync(repoNxJsBackupPath, repoNxJsPath);
      }
    },
    TEST_TIMEOUT,
  );
});
