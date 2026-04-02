import { detectPackageManager, Executor, ExecutorContext, getPackageManagerCommand } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { build, execWithRetry } from '../common';
import { getLockfileSnapshots, restoreLockfiles } from './lockfile-snapshots';
import { createRuntimePackageCollector } from './runtime-package-collector';
import { PublishExecutorSchema } from './schema';
import { createTemporaryAppPackageJsonManager } from './temporary-app-package-json';

const getInstallCommand = () => {
  const rawInstallCommand = getPackageManagerCommand().install;

  const packageManager = detectPackageManager();
  return packageManager === 'pnpm' ? `${rawInstallCommand} --node-linker=hoisted` : rawInstallCommand;
};

const getConfiguredProjectRoot = (context: ExecutorContext) => {
  const { projectName, projectsConfigurations } = context;
  if (!projectName) {
    console.error('No project name provided in context. Aborting publish.');
    return null;
  }

  const configuredProjectRoot = projectsConfigurations.projects[projectName].root;
  if (!configuredProjectRoot) {
    console.error(`Could not find project root for [${projectName}]. Aborting publish.`);
    return null;
  }

  return configuredProjectRoot;
};

const executor: Executor<PublishExecutorSchema> = async (options, context) => {
  const runtimePackageCollector = createRuntimePackageCollector();
  const success = await build(context, runtimePackageCollector.customTransformers);

  if (!success) {
    console.error('Build failed. Aborting publish.');
    return { success: false };
  }

  const configuredProjectRoot = getConfiguredProjectRoot(context);
  if (!configuredProjectRoot) return { success: false };

  const { isVerbose, cwd, target } = context;
  const appRoot = path.resolve(cwd, configuredProjectRoot);
  const appPackageJsonManager = createTemporaryAppPackageJsonManager(cwd, appRoot, runtimePackageCollector.getCollectedPackages());
  const lockfileSnapshots = getLockfileSnapshots(appRoot);

  try {
    // This will temporarily add any missing dependencies to the app's package.json that were collected during the build step and that exist in the workspace package.json.
    // This is necessary to ensure that the published azure function has all the dependencies it needs to run, without requiring the user to manually add them to their package.json.
    appPackageJsonManager.apply();

    const installCommand = getInstallCommand();
    if (isVerbose) console.log(`Running ${target?.executor} command: ${installCommand}.`);
    execSync(installCommand, { stdio: 'inherit', cwd: appRoot });

    const { name, additionalFlags } = options;
    const publishCommand = `func azure functionapp publish ${name}${additionalFlags ? ` ${additionalFlags}` : ''}`;
    if (isVerbose) console.log(`Running ${target?.executor} command: ${publishCommand}.`);
    execWithRetry('Publish', publishCommand, { cwd: appRoot, stdio: 'inherit' });
  } finally {
    appPackageJsonManager.restore();
    restoreLockfiles(lockfileSnapshots);
    fs.rmSync(path.join(appRoot, 'node_modules'), { recursive: true, force: true });
  }

  return { success: true };
};

export default executor;
