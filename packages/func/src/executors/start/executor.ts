import { Executor, readJsonFile } from '@nx/devkit';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { fileExists } from 'nx/src/utils/fileutils';
import treeKill from 'tree-kill';
import { color } from '../../common';
import { build, watch } from '../common';
import { FuncLogger } from './func-logger';
import { StartExecutorSchema } from './schema';

const loadProcessEnvWithoutOverrides = (projectCwd: string) => {
  const localProcessEnvCopy = { ...process.env };
  const localSettingsJsonPath = `${projectCwd}/local.settings.json`;
  if (!fileExists(localSettingsJsonPath)) return localProcessEnvCopy;

  const localSettingsConfig = readJsonFile<{ Values: Record<string, string> }>(localSettingsJsonPath).Values;
  if (!localSettingsConfig) return localProcessEnvCopy;

  Object.keys(localSettingsConfig).forEach(key => delete localProcessEnvCopy[key]);

  return localProcessEnvCopy;
};

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const { port, disableWatch, additionalFlags } = options;
  const { workspace, projectName, isVerbose, target } = context;

  const logger = new FuncLogger(projectName);
  let spawned: ChildProcessWithoutNullStreams | null = null;

  const funcStart = () => {
    const params = ['start', `--port ${port}`];
    if (additionalFlags) params.push(additionalFlags);

    if (isVerbose) console.log(`Running ${target.executor} command: func ${params.join(' ')}.`);

    const cwd = workspace?.projects[projectName].root;
    const noOverridesEnvVars = loadProcessEnvWithoutOverrides(cwd);
    spawned = spawn('func', params, { cwd, detached: false, shell: true, env: noOverridesEnvVars });

    spawned.stdout.on('data', data => logger.logData(data?.toString()));
    spawned.stderr.on('data', data => logger.logError(data?.toString()));
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
