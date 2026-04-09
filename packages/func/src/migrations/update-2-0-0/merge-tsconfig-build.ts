import { getProjects, readJson, Tree, updateJson } from '@nx/devkit';
import { color, FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';

const buildManagedOptions = new Set(['noEmitOnError', 'rootDir', 'tsBuildInfoFile', 'paths']);
const skippedTopLevelKeys = new Set(['extends', 'compilerOptions']);

type TsConfig = {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
  files?: string[];
  [key: string]: unknown;
};

const mergeTsconfigBuildForProject = (tree: Tree, projectRoot: string) => {
  const buildConfigPath = `${projectRoot}/tsconfig.build.json`;
  const workspaceConfigPath = `${projectRoot}/tsconfig.json`;

  if (!tree.exists(workspaceConfigPath)) {
    console.warn(
      color.warn('WARNING'),
      `Project at [${projectRoot}] has no tsconfig.json. This file is now required by the build executor — the function app will not build correctly.`,
    );
    return;
  }

  const buildConfig = tree.exists(buildConfigPath) ? readJson<TsConfig>(tree, buildConfigPath) : {};

  updateJson<TsConfig>(tree, workspaceConfigPath, workspaceConfig => {
    const compilerOptions = (workspaceConfig.compilerOptions ??= {});

    for (const [key, value] of Object.entries(buildConfig.compilerOptions ?? {})) {
      if (buildManagedOptions.has(key)) continue;
      compilerOptions[key] = value;
    }

    compilerOptions.outDir ??= 'dist';

    for (const [key, value] of Object.entries(buildConfig)) {
      if (skippedTopLevelKeys.has(key)) continue;
      workspaceConfig[key] = value;
    }

    return workspaceConfig;
  });

  if (tree.exists(buildConfigPath)) tree.delete(buildConfigPath);
};

const mergeTsconfigBuild = (tree: Tree) => {
  for (const [, project] of getProjects(tree)) {
    const hasFuncBuild = Object.values(project.targets ?? {}).some(
      target => target.executor === `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:build`,
    );
    if (hasFuncBuild) mergeTsconfigBuildForProject(tree, project.root);
  }
};

export default mergeTsconfigBuild;
