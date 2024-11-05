import { Executor } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { build } from '../common';
import { PublishExecutorSchema } from './schema';

const executor: Executor<PublishExecutorSchema> = async (options, context) => {
  const success = await build(context);

  if (success) {
    const { projectName, projectsConfigurations, isVerbose, target } = context;

    const { name, additionalFlags } = options;
    const installCommand = 'npm i';
    if (isVerbose) {
      console.log(`Running ${target.executor} command: ${installCommand}.`);
    }

    const cwd = projectsConfigurations?.projects[projectName].root;
    execSync(installCommand, { stdio: 'inherit', cwd });

    const publishCommand = `func azure functionapp publish ${name}${additionalFlags ? ` ${additionalFlags}` : ''}`;
    if (isVerbose) {
      console.log(`Running ${target.executor} command: ${publishCommand}.`);
    }
    execSync(publishCommand, { cwd, stdio: 'inherit' });

    fs.rmSync(path.join(cwd, 'node_modules'), { recursive: true, force: true });
  }

  return { success };
};

export default executor;
