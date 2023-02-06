import { ensureNxProject, runNxCommandAsync, uniq } from '@nrwl/nx-plugin/testing';

describe('func e2e', () => {
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

  it('should init & build func', async () => {
    const project = uniq('func');
    console.log('Initializing project: ' + project);

    const initResult = await runNxCommandAsync(`generate @nx-azure/func:init ${project} --verbose`);

    console.log('Init Result:');
    console.log(initResult);
    console.log('\n');

    const buildResult = await runNxCommandAsync(`build ${project}`);

    console.log('Build Result:');
    console.log(buildResult);
    console.log('\n');

    expect(buildResult.stdout).toContain('Executor ran');
  }, 120000);
});
