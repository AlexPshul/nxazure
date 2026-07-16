import { Executor, ExecutorContext } from '@nx/devkit';
import fs from 'fs';
import path from 'path';
import { build, createPackageJsonDependencySync, createRuntimePackageCollector, execWithRetry, installFunctionAppDependencies } from '../common';
import { getLockfileSnapshots, restoreLockfiles } from './lockfile-snapshots';
import { PublishExecutorSchema } from './schema';

const resolvePublishName = (name?: string) => {
  const publishName = name?.trim();
  if (!publishName)
    throw new Error(
      'No Azure Function App name was provided. Pass -n <function-app-name> or set targets.publish.options.name in project.json.',
    );

  return publishName.replace(/\{([^{}]*)\}/g, (_match, environmentVariableName: string) => {
    const normalizedEnvironmentVariableName = environmentVariableName.trim();
    if (!normalizedEnvironmentVariableName) throw new Error('Azure Function App name contains an empty environment variable template.');

    const environmentVariableValue = process.env[normalizedEnvironmentVariableName]?.trim();
    if (!environmentVariableValue)
      throw new Error(
        `Environment variable [${normalizedEnvironmentVariableName}] is required by the Azure Function App name template.`,
      );

    return environmentVariableValue;
  });
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
  const publishName = resolvePublishName(options.name);
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
  const packageJsonDependencySync = createPackageJsonDependencySync(cwd, appRoot, runtimePackageCollector.getCollectedPackages());
  const lockfileSnapshots = getLockfileSnapshots(appRoot);

  try {
    // This will temporarily add any missing dependencies to the app's package.json that were collected during the build step and that exist in the workspace package.json.
    // This is necessary to ensure that the published azure function has all the dependencies it needs to run, without requiring the user to manually add them to their package.json.
    packageJsonDependencySync.apply();

    installFunctionAppDependencies(context, appRoot);

    const { additionalFlags } = options;
    const publishCommand = `func azure functionapp publish ${publishName}${additionalFlags ? ` ${additionalFlags}` : ''}`;
    if (isVerbose) console.log(`Running ${target?.executor} command: ${publishCommand}.`);
    execWithRetry('Publish', publishCommand, { cwd: appRoot, stdio: 'inherit' });
  } finally {
    packageJsonDependencySync.restore();
    restoreLockfiles(lockfileSnapshots);
    fs.rmSync(path.join(appRoot, 'node_modules'), { recursive: true, force: true });
  }

  return { success: true };
};

export default executor;
