import { getProjects, readJson, Tree, updateJson } from '@nx/devkit';
import { FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';

const removeRegisterPathsForProject = (tree: Tree, projectRoot: string) => {
  const registerPathsFile = `${projectRoot}/_registerPaths.ts`;
  if (tree.exists(registerPathsFile)) tree.delete(registerPathsFile);

  const eslintConfigPath = `${projectRoot}/.eslintrc.json`;
  if (!tree.exists(eslintConfigPath)) return;

  const eslintConfig = readJson<{ ignorePatterns?: string[] }>(tree, eslintConfigPath);
  const ignorePatterns = eslintConfig.ignorePatterns;
  if (!ignorePatterns?.includes('_registerPaths.ts')) return;

  eslintConfig.ignorePatterns = ignorePatterns.filter(p => p !== '_registerPaths.ts');
  tree.write(eslintConfigPath, JSON.stringify(eslintConfig, null, 2));
};

const removeTsconfigPathsDependency = (tree: Tree) => {
  updateJson<{ dependencies?: Record<string, string> }>(tree, 'package.json', json => {
    if (json.dependencies?.['tsconfig-paths']) delete json.dependencies['tsconfig-paths'];
    return json;
  });
};

const removePathRegistration = (tree: Tree) => {
  removeTsconfigPathsDependency(tree);

  for (const [, project] of getProjects(tree)) {
    const hasFuncBuild = Object.values(project.targets ?? {}).some(
      target => target.executor === `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:build`,
    );
    if (hasFuncBuild) removeRegisterPathsForProject(tree, project.root);
  }
};

export default removePathRegistration;
