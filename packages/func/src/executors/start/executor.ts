import { StartExecutorSchema } from './schema';
import { Executor } from '@nrwl/devkit';
import { build } from '../common/utils';
import { execSync } from 'child_process';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const success = build(context);

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
