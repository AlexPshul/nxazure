import { ExecutorContext } from '@nx/devkit';
import { AssetGlobPattern, BuildExecutorSchema } from '../build/schema';

type CopyAssetsFn = (
  options: {
    outputPath: string;
    assets: (string | AssetGlobPattern)[];
    includeIgnoredAssetFiles?: boolean;
  },
  context: ExecutorContext,
) => Promise<{ success?: boolean; stop?: () => void }>;

let copyAssetsPromise: Promise<CopyAssetsFn> | null = null;

const getBuildTargetOptions = (context: ExecutorContext): BuildExecutorSchema => {
  const project = context.projectsConfigurations?.projects[context.projectName];
  const buildTarget = project?.targets?.build;

  return (buildTarget?.options as BuildExecutorSchema | undefined) ?? {};
};

const hasAssets = (options: BuildExecutorSchema) => Array.isArray(options.assets) && options.assets.length > 0;

const isMissingNxJsError = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  const knownError = error as Error & { code?: string };
  return (
    knownError.code === 'ERR_MODULE_NOT_FOUND' ||
    knownError.code === 'MODULE_NOT_FOUND' ||
    error.message.includes("'@nx/js'") ||
    error.message.includes('"@nx/js"') ||
    error.message.includes('Cannot find module')
  );
};

const loadCopyAssets = async () => {
  if (!copyAssetsPromise) {
    copyAssetsPromise = import('@nx/js').then(module => module.copyAssets as CopyAssetsFn);
  }

  try {
    return await copyAssetsPromise;
  } catch (error) {
    copyAssetsPromise = null;

    if (isMissingNxJsError(error)) {
      throw new Error(
        'Asset copying for @nxazure/func requires the optional peer dependency "@nx/js" when the build target configures "assets".\n\n' +
          'Install it with:\n' +
          '  npm install -D @nx/js',
      );
    }

    throw error;
  }
};

export const copyAssetsIfConfigured = async (context: ExecutorContext, outputPath: string) => {
  const buildOptions = getBuildTargetOptions(context);
  if (!hasAssets(buildOptions)) return;

  const copyAssets = await loadCopyAssets();
  await copyAssets(
    {
      outputPath,
      assets: buildOptions.assets,
      includeIgnoredAssetFiles: buildOptions.includeIgnoredAssetFiles,
    },
    context,
  );
};
