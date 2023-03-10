import { Executor } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { build } from '../common/utils';
import { PublishExecutorSchema } from './schema';
import fs from 'fs';
import path from 'path';

const executor: Executor<PublishExecutorSchema> = async (options, context) => {
  const success = build(context);

  if (success) {
    const cwd = context.workspace?.projects[context.projectName].root;

    execSync('npm i', { stdio: 'inherit', cwd });
    execSync(`func azure functionapp publish ${options.name}`, {
      cwd,
      stdio: 'inherit',
    });

    fs.rmSync(path.join(cwd, 'node_modules'), { recursive: true, force: true });
  }

  return { success };
};

export default executor;
