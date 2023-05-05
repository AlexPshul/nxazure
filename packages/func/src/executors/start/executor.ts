import { Executor } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { build } from '../common/utils';
import { StartExecutorSchema } from './schema';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const success = build(context);

  if (success) {
    const { workspace, projectName, isVerbose, target } = context;
    const cwd = workspace?.projects[projectName].root;

    const { port, additionalFlags } = options;
    const command = `func start --port ${port} ${additionalFlags}`;
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
