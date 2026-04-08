import { ExecutorContext } from '@nx/devkit';
import path from 'path';
import { AssetGlobPattern, BuildExecutorSchema } from '../build/schema';

type CopyAssetsResult = { success?: boolean; stop?: () => void };
type FileEvent = { type: 'create' | 'update' | 'delete'; src: string; dest: string };
type DefaultFileEventHandler = (events: FileEvent[]) => void;
type CopyAssetsHandler = {
  processAllAssetsOnce: () => Promise<void>;
};
type CopyAssetsHandlerFactory = new (options: {
  projectDir: string;
  rootDir: string;
  outputDir: string;
  assets: (string | AssetGlobPattern)[];
  callback?: (events: FileEvent[]) => void;
  includeIgnoredFiles?: boolean;
}) => CopyAssetsHandler;

let nxJsAssetsPromise: Promise<{
  CopyAssetsHandler: CopyAssetsHandlerFactory;
  defaultFileEventHandler: DefaultFileEventHandler;
}> | null = null;

const getBuildTargetOptions = (context: ExecutorContext): BuildExecutorSchema => {
  if (!context.projectName) return {};
  const project = context.projectsConfigurations?.projects[context.projectName];
  const buildTarget = project?.targets?.build;

  return (buildTarget?.options as BuildExecutorSchema | undefined) ?? {};
};

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

const loadNxJsAssets = async () => {
  if (!nxJsAssetsPromise) {
    // @ts-expect-error — @nx/js is an optional peer dependency resolved at runtime
    nxJsAssetsPromise = import('@nx/js/src/utils/assets/copy-assets-handler').then(module => ({
      CopyAssetsHandler: module.CopyAssetsHandler as CopyAssetsHandlerFactory,
      defaultFileEventHandler: module.defaultFileEventHandler as DefaultFileEventHandler,
    }));
  }

  try {
    return await nxJsAssetsPromise;
  } catch (error) {
    nxJsAssetsPromise = null;

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

const getWorkspaceDistRoot = (workspaceRoot: string, outputPath: string) => path.resolve(workspaceRoot, outputPath);

const runCopyAssets = async (
  CopyAssetsHandler: CopyAssetsHandlerFactory,
  options: {
    projectDir: string;
    rootDir: string;
    outputDir: string;
    assets: (string | AssetGlobPattern)[];
    includeIgnoredFiles?: boolean;
    callback?: (events: FileEvent[]) => void;
  },
) => {
  if (options.assets.length === 0) return;

  const assetHandler = new CopyAssetsHandler(options);
  await assetHandler.processAllAssetsOnce();
};

const getStringAssetCallback = (workspaceRoot: string, distRoot: string, defaultFileEventHandler: DefaultFileEventHandler) => {
  return (events: FileEvent[]) =>
    defaultFileEventHandler(
      events.map(event => ({
        ...event,
        dest: path.join(distRoot, path.relative(workspaceRoot, event.src)),
      })),
    );
};

export const copyAssetsIfConfigured = async (
  _context: ExecutorContext,
  appRoot: string,
  outputPath: string,
): Promise<CopyAssetsResult | void> => {
  const context = _context;
  const { assets, includeIgnoredAssetFiles } = getBuildTargetOptions(context);
  if (!assets || assets.length === 0) return;

  const distRoot = getWorkspaceDistRoot(context.root, outputPath);
  const stringAssets = assets.filter((asset): asset is string => typeof asset === 'string');
  const objectAssets = assets.filter((asset): asset is AssetGlobPattern => typeof asset !== 'string');
  const { CopyAssetsHandler, defaultFileEventHandler } = await loadNxJsAssets();

  await runCopyAssets(CopyAssetsHandler, {
    projectDir: appRoot,
    rootDir: context.root,
    outputDir: distRoot,
    assets: stringAssets,
    includeIgnoredFiles: includeIgnoredAssetFiles,
    callback: getStringAssetCallback(context.root, distRoot, defaultFileEventHandler),
  });
  await runCopyAssets(CopyAssetsHandler, {
    projectDir: appRoot,
    rootDir: context.root,
    outputDir: distRoot,
    assets: objectAssets,
    includeIgnoredFiles: includeIgnoredAssetFiles,
    callback: defaultFileEventHandler,
  });
};
