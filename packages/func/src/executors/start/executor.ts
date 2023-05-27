import { Executor } from '@nx/devkit';
import { execSync } from 'child_process';
import { build } from '../common/build';
import { StartExecutorSchema } from './schema';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const success = await build(context);

  if (success) {
    const { workspace, projectName, isVerbose, target } = context;
    const cwd = workspace?.projects[projectName].root;

    const { port, additionalFlags } = options;
    const command = `func start --port ${port}${additionalFlags ? ` ${additionalFlags}` : ''}`;
    if (isVerbose) {
      console.log(`Running ${target.executor} command: ${command}.`);
    }

    execSync(command, {
      cwd,
      stdio: 'inherit',
    });
  }

  return { success };
};

export default executor;
