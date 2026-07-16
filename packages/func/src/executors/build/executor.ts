import { Executor, ExecutorContext } from '@nx/devkit';
import path from 'path';
import { build, createPackageJsonDependencySync, createRuntimePackageCollector, installFunctionAppDependencies } from '../common';
import { BuildExecutorSchema } from './schema';

const getConfiguredProjectRoot = (context: ExecutorContext) => {
  const { projectName, projectsConfigurations } = context;
  if (!projectName) throw new Error('Missing projectName in executor context.');

  const configuredProjectRoot = projectsConfigurations?.projects[projectName]?.root;
  if (!configuredProjectRoot) throw new Error(`Project "${projectName}" not found in workspace configuration.`);

  return configuredProjectRoot;
};

const executor: Executor<BuildExecutorSchema> = async (options, context) => {
  const syncMode = options.packageJsonDependencySync ?? 'none';
  if (syncMode === 'none') return { success: await build(context) };

  const runtimePackageCollector = createRuntimePackageCollector();
  const success = await build(context, runtimePackageCollector.customTransformers);
  if (!success) return { success: false };

  const configuredProjectRoot = getConfiguredProjectRoot(context);
  const appRoot = path.resolve(context.cwd, configuredProjectRoot);
  const packageJsonDependencySync = createPackageJsonDependencySync(context.cwd, appRoot, runtimePackageCollector.getCollectedPackages());
  packageJsonDependencySync.apply();

  if (syncMode === 'install') installFunctionAppDependencies(context, appRoot);

  return { success: true };
};

export default executor;
