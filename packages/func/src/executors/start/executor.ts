import { Executor } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { build } from '../common/utils';
import { StartExecutorSchema } from './schema';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const success = await build(context);

  if (success) {
    const cwd = context.workspace?.projects[context.projectName].root;

    execSync(`func start --port ${options.port}`, {
      cwd,
      stdio: 'inherit',
    });
  }

  return { success };
};

export default executor;
