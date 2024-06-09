import { NxJsonConfiguration } from '@nx/devkit';
import { ensureNxProject, readJson, runCommand, runNxCommandAsync, uniq, updateFile } from '@nx/plugin/testing';

describe('Project initialization and build', () => {
  const TEST_TIMEOUT = 180000;
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
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
  });

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });

  it(
    'should init & build a workspace with a js lib and, a functions app and a function that uses that lib',
    async () => {
      const project = uniq('func');
      const lib = uniq('lib');
      const func = 'hello';

      await runNxCommandAsync(`generate @nxazure/func:init ${project}`);
      await runNxCommandAsync(`generate @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
      await runNxCommandAsync(`generate @nx/js:library ${lib}`);

      const funcFilePath = `apps/${project}/${func}/index.ts`;

      updateFile(
        funcFilePath,
        ` import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
        import { ${lib} } from "@proj/${lib}";

        export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
            const name = request.query.get('name') || await request.text() || 'world';

            return { body: ${lib}() };
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
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a js lib, a nested functions app (apps/test/my-app) and a function that uses that lib',
    async () => {
      const project = `sub-app/${uniq('func')}`;
      const lib = uniq('lib');
      const func = 'hello';

      await runNxCommandAsync(`generate @nxazure/func:init ${project}`);
      await runNxCommandAsync(`generate @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
      await runNxCommandAsync(`generate @nx/js:library ${lib}`);

      const funcFilePath = `apps/${project}/${func}/index.ts`;

      updateFile(
        funcFilePath,
        ` import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
        import { ${lib} } from "@proj/${lib}";

        export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
            const name = request.query.get('name') || await request.text() || 'world';

            return { body: ${lib}() };
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
    },
    TEST_TIMEOUT,
  );
});
