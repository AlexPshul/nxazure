import { Executor } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { build } from '../common/utils';
import { StartExecutorSchema } from './schema';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const success = build(context);

  if (success) {
    const cwd = context.workspace?.projects[context.projectName].root;

    execSync(`func start ${options.additionalFlags}`, {
      cwd,
      stdio: 'inherit',
    });
  }

  return { success };
};

export default executor;
