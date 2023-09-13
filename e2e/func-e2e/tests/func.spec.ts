import { NxJsonConfiguration } from '@nx/devkit';
import { ensureNxProject, readJson, runCommand, runNxCommandAsync, uniq, updateFile } from '@nx/plugin/testing';
import { CompilerOptions } from 'typescript';

describe('Project initialization and build', () => {
  const TEST_TIMEOUT = 120000;
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    ensureNxProject('@nxazure/func', 'dist/packages/func');

    const nxConfig = readJson<NxJsonConfiguration>('nx.json');
    nxConfig.workspaceLayout = {
      projectNameAndRootFormat: 'derived',
      appsDir: 'apps',
      libsDir: 'libs',
    };

    updateFile('nx.json', JSON.stringify(nxConfig, null, 2));

    runCommand('npm i @types/node@latest', {});
  });

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });

  it(
    'should init & build and empty workspace with a functions app',
    async () => {
      const project = uniq('func');
      await runNxCommandAsync(`generate @nxazure/func:init ${project}`);
      const buildResult = await runNxCommandAsync(`build ${project}`);

      expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a functions app and a function',
    async () => {
      const project = uniq('func');
      const func = 'hello';

      await runNxCommandAsync(`generate @nxazure/func:init ${project}`);
      await runNxCommandAsync(`generate @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
      const buildResult = await runNxCommandAsync(`build ${project}`);

      expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a js lib functions app and a function',
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
        ` import { AzureFunction, Context, HttpRequest } from "@azure/functions"
        import { ${lib} } from "@proj/${lib}";

        const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
          context.res = {
                // status: 200, /* Defaults to 200 */
                body: ${lib}()
            };

        };

        export default httpTrigger;
    `,
      );

      const buildResult = await runNxCommandAsync(`build ${project}`);

      expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
    },
    TEST_TIMEOUT,
  );

  it(
    'Use strict mode',
    async () => {
      const project = uniq('func');
      await runNxCommandAsync(`generate @nxazure/func:init ${project}`);

      const tsConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.json`);
      const tsBuildConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.build.json`);

      expect(tsConfig.compilerOptions.strict).toBe(true);
      expect(tsBuildConfig.compilerOptions.strict).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'Use no strict mode',
    async () => {
      const project = uniq('func');
      await runNxCommandAsync(`generate @nxazure/func:init ${project} --no-strict`);

      const tsConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.json`);
      const tsBuildConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.build.json`);

      expect(tsConfig.compilerOptions.strict).toBe(false);
      expect(tsBuildConfig.compilerOptions.strict).toBe(false);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build and empty workspace with a functions app (V4)',
    async () => {
      const project = uniq('func');
      await runNxCommandAsync(`generate @nxazure/func:init ${project} --v4`);
      const buildResult = await runNxCommandAsync(`build ${project}`);

      expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a functions app and a function (V4)',
    async () => {
      const project = uniq('func');
      const func = 'hello';

      await runNxCommandAsync(`generate @nxazure/func:init ${project} --v4`);
      await runNxCommandAsync(`generate @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
      const buildResult = await runNxCommandAsync(`build ${project}`);

      expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a js lib functions app and a function (V4)',
    async () => {
      const project = uniq('func');
      const lib = uniq('lib');
      const func = 'hello';

      await runNxCommandAsync(`generate @nxazure/func:init ${project} --v4`);
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
    'Use strict mode (V4)',
    async () => {
      const project = uniq('func');
      await runNxCommandAsync(`generate @nxazure/func:init ${project} --v4`);

      const tsConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.json`);
      const tsBuildConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.build.json`);

      expect(tsConfig.compilerOptions.strict).toBe(true);
      expect(tsBuildConfig.compilerOptions.strict).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'Use no strict mode (V4)',
    async () => {
      const project = uniq('func');
      await runNxCommandAsync(`generate @nxazure/func:init ${project} --no-strict --v4`);

      const tsConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.json`);
      const tsBuildConfig = await readJson<{ compilerOptions: CompilerOptions }>(`apps/${project}/tsconfig.build.json`);

      expect(tsConfig.compilerOptions.strict).toBe(false);
      expect(tsBuildConfig.compilerOptions.strict).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
