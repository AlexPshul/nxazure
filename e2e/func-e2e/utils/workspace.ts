import { NxJsonConfiguration } from '@nx/devkit';
import { ensureNxProject, readJson, runCommand, runNxCommandAsync, updateFile } from '@nx/plugin/testing';

export const lib1 = 'lvl1lib';
const lib2 = 'lvl2lib';

export const setupWorkspace = async () => {
  process.env.CI = 'true';
  process.env.NX_DAEMON = 'false';
  process.env.NX_INTERACTIVE = 'false';

  console.log('Before all');
  ensureNxProject('@nxazure/func', 'dist/packages/func');
  runCommand('git init && git add -A', {});
  console.log('After ensureNxProject');

  const nxConfig = readJson<NxJsonConfiguration>('nx.json');
  nxConfig.workspaceLayout = { appsDir: 'apps', libsDir: 'libs' };

  updateFile('nx.json', JSON.stringify(nxConfig, null, 2));

  console.log('Installing types');
  runCommand('npm i @types/node@latest', {});

  console.log('Generating libraries');
  await runNxCommandAsync(`g @nx/js:library ${lib1} --directory=libs/${lib1} --bundler=none --linter=none --unitTestRunner=none`);
  await runNxCommandAsync(`g @nx/js:library ${lib2} --directory=libs/${lib2} --bundler=none --linter=none --unitTestRunner=none`);

  const libFilePath = `libs/${lib1}/src/lib/${lib1}.ts`;
  updateFile(
    libFilePath,
    `
import { ${lib2} } from '@proj/${lib2}';

export function ${lib1}(): string {
return ${lib2}();
}
      `,
  );
  console.log('Generated the libs and ready to test');
};

export const resetWorkspace = async () => {
  await runNxCommandAsync('reset');
};
