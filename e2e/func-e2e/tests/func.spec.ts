import { ensureNxProject, runNxCommandAsync, uniq, updateFile } from '@nrwl/nx-plugin/testing';

describe('Project initialization and build', () => {
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(() => {
    ensureNxProject('@nx-azure/func', 'dist/packages/func');
  });

  afterAll(() => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    runNxCommandAsync('reset');
  });

  it('should init & build and empty workspace with a functions app', async () => {
    const project = uniq('func');
    await runNxCommandAsync(`generate @nx-azure/func:init ${project}`);
    const buildResult = await runNxCommandAsync(`build ${project}`);

    expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
  }, 120000);

  it('should init & build a workspace with a functions app and a function', async () => {
    const project = uniq('func');
    const func = 'hello';

    await runNxCommandAsync(`generate @nx-azure/func:init ${project} --verbose`);
    await runNxCommandAsync(`generate @nx-azure/func:new ${func} --project=${project} --template="HTTP trigger"`);
    const buildResult = await runNxCommandAsync(`build ${project}`);

    expect(buildResult.stdout).toContain(`Done compiling TypeScript files for project "${project}"`);
  }, 120000);

  it('should init & build a workspace with a js lib functions app and a function', async () => {
    const project = uniq('func');
    const lib = uniq('lib');
    const func = 'hello';

    await runNxCommandAsync(`generate @nx-azure/func:init ${project} --verbose`);
    await runNxCommandAsync(`generate @nx-azure/func:new ${func} --project=${project} --template="HTTP trigger"`);
    await runNxCommandAsync(`generate @nrwl/js:library ${lib}`);

    const funcFilePath = `apps/${project}/${func}/index.ts`;

    updateFile(
      funcFilePath,
      `
        import '../_registerPaths'; // Import before any other lib imports
        import { AzureFunction, Context, HttpRequest } from "@azure/functions"
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
  }, 120000);
});
