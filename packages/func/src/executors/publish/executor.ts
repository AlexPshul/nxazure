import { Executor, readJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { color } from '../../common';
import { build } from '../common/build';
import { PublishExecutorSchema } from './schema';

const executor: Executor<PublishExecutorSchema> = async (options, context) => {
  const success = await build(context);

  if (success) {
    const { projectName, workspace, isVerbose, target } = context;

    const cwd = workspace?.projects[projectName].root;
    const localSettings = readJsonFile<{ Values: Record<string, string> }>(path.join(cwd, 'local.settings.json'));
    if (localSettings.Values.AzureWebJobsFeatureFlags === 'EnableWorkerIndexing') {
      console.log(color.warn('[V4 FUNCTION][ATTENTION]'));
      console.log(color.warn('Add the configuration "AzureWebJobsFeatureFlags": "EnableWorkerIndexing" to your deployment.'));
    }

    const { name, additionalFlags } = options;
    const installCommand = 'npm i';
    if (isVerbose) {
      console.log(`Running ${target.executor} command: ${installCommand}.`);
    }
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
