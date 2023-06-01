import { Executor } from '@nx/devkit';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import treeKill from 'tree-kill';
import { color } from '../../common';
import { build, watch } from '../common';
import { StartExecutorSchema } from './schema';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const { port, disableWatch, additionalFlags } = options;
  const { workspace, projectName, isVerbose, target } = context;

  let spawned: ChildProcessWithoutNullStreams | null = null;

  const funcStart = () => {
    const params = ['start', `--port ${port}`];
    if (additionalFlags) params.push(additionalFlags);

    if (isVerbose) console.log(`Running ${target.executor} command: func ${params.join(' ')}.`);

    const cwd = workspace?.projects[projectName].root;
    spawned = spawn('func', params, { cwd, detached: false, shell: true });

    spawned.stdout.on('data', data => console.log(color.info(`[${projectName}]`), data.toString()));
    spawned.stderr.on('data', data => console.error(color.error(`ERROR [${projectName}]:`), data.toString()));
  };

  if (disableWatch) {
    await build(context);
    funcStart();
  } else {
    await watch(
      context,
      () => !spawned && funcStart(),
      () => {
        if (!spawned) return;

        console.log(color.error(`[${projectName}]`), 'Shutting down...');
        treeKill(spawned.pid);
        spawned = null;
      },
    );
  }

  // This promise is awaited but never resolved because the start action should never stop, unless closed by the user.
  return { success: await new Promise<boolean>(() => {}) }; // eslint-disable-line @typescript-eslint/no-empty-function
};

export default executor;
