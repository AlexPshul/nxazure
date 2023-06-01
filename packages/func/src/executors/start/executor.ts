import { Executor } from '@nx/devkit';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { watch } from '../common';
import { StartExecutorSchema } from './schema';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  await watch(context);

  const { workspace, projectName, isVerbose, target } = context;
  const cwd = workspace?.projects[projectName].root;

  const { port, additionalFlags } = options;

  let spawned: ChildProcessWithoutNullStreams | null = null;

  // This promise is awaited but never resolved because the start action should never stop, unless closed by the user.
  const execPromise = new Promise<boolean>(() => {
    const params = ['start', `--port ${port}`];
    if (additionalFlags) params.push(additionalFlags);

    if (isVerbose) console.log(`Running ${target.executor} command: func ${params.join(' ')}.`);

    spawned = spawn('func', params, { cwd, detached: false, shell: true });

    spawned.stdout.on('data', data => console.log(data.toString()));
    spawned.stderr.on('data', data => console.error(`ERROR [${projectName}]:`, data.toString()));

    spawned.on('error', err => console.error('Got an error in the spawn.', err));
  });

  return { success: await execPromise };
};

export default executor;
