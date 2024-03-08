import { Tree, getProjects, readJson } from '@nx/devkit';
import { FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';

type EslintConfig = { ignorePatterns: string[] };
const ignoredItemsToAdd = ['dist', 'node_modules', '_registerPaths.ts'];

const updateEslintConfig = (host: Tree) => {
  const projects = getProjects(host);

  Array.from(projects)
    .filter(([, project]) => project.targets?.build?.executor === `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:build`)
    .filter(([, project]) => host.exists(`${project.root}/.eslintrc.json`))
    .forEach(([, project]) => {
      const projectEslintConfig = readJson<EslintConfig>(host, `${project.root}/.eslintrc.json`);
      ignoredItemsToAdd
        .filter(itemToAdd => !projectEslintConfig.ignorePatterns.includes(itemToAdd))
        .forEach(itemToAdd => projectEslintConfig.ignorePatterns.push(itemToAdd));

      host.write(`${project.root}/.eslintrc.json`, JSON.stringify(projectEslintConfig, null, 2));
    });
};

export default updateEslintConfig;
