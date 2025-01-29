import { NxJsonConfiguration } from '@nx/devkit';
import { ensureNxProject, readJson, runCommand, runCommandAsync, runNxCommandAsync, uniq, updateFile } from '@nx/plugin/testing';

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
    console.log('Before all');
    ensureNxProject('@nxazure/func', 'dist/packages/func');
    console.log('After ensureNxProject');

    const nxConfig = readJson<NxJsonConfiguration>('nx.json');
    nxConfig.workspaceLayout = {
      appsDir: 'apps',
      libsDir: 'libs',
    };

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

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });

  const checkTheThing = async (project: string, directory: string) => {
    const func = 'hello';

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

    const buildResult = await runNxCommandAsync(`build ${project}`);

    expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
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
});
