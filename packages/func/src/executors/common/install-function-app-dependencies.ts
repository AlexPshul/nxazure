import { detectPackageManager, ExecutorContext, getPackageManagerCommand } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const findPnpmWorkspace = (workspaceRoot: string, appRoot: string) => {
  let directory = appRoot;
  while (true) {
    if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) return directory;
    if (directory === workspaceRoot) return;
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
};

const getPackageInstallCommand = (workspaceRoot: string, appRoot: string) => {
  const rawInstallCommand = getPackageManagerCommand().install;

  const packageManager = detectPackageManager();
  if (packageManager !== 'pnpm') return { command: rawInstallCommand, cwd: appRoot };

  const pnpmWorkspace = findPnpmWorkspace(workspaceRoot, appRoot);
  if (!pnpmWorkspace) return { command: `${rawInstallCommand} --node-linker=hoisted --ignore-workspace`, cwd: appRoot };
  if (pnpmWorkspace === appRoot) {
    console.log(`Using the existing pnpm-workspace.yaml in ${appRoot}.`);
    return { command: `${rawInstallCommand} --node-linker=hoisted`, cwd: appRoot };
  }

  const appPath = path.relative(pnpmWorkspace, appRoot).replace(/\\/g, '/');
  return {
    command: `${rawInstallCommand} --workspace-packages=${appPath} --filter ./${appPath} --fail-if-no-match --node-linker=hoisted --config.shared-workspace-lockfile=false`,
    cwd: pnpmWorkspace,
  };
};

export const installFunctionAppDependencies = (context: Pick<ExecutorContext, 'cwd' | 'isVerbose' | 'target'>, appRoot: string) => {
  const { command, cwd } = getPackageInstallCommand(context.cwd, appRoot);
  if (context.isVerbose) console.log(`Running ${context.target?.executor} command: ${command} in ${cwd}.`);
  execSync(command, { stdio: 'inherit', cwd });
};
