import { Executor, readJsonFile } from '@nrwl/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { color } from '../../common';
import { build } from '../common/utils';
import { PublishExecutorSchema } from './schema';

const executor: Executor<PublishExecutorSchema> = async (options, context) => {
  const success = await build(context);

  if (success) {
    const cwd = context.workspace?.projects[context.projectName].root;
    const localSettings = readJsonFile<{ Values: Record<string, string> }>(path.join(cwd, 'local.settings.json'));
    if (localSettings.Values.AzureWebJobsFeatureFlags === 'EnableWorkerIndexing') {
      console.log(color.warn('[V4 FUNCTION][ATTENTION]'));
      console.log(color.warn('Add the configuration "AzureWebJobsFeatureFlags": "EnableWorkerIndexing" to your deployment.'));
    }

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
