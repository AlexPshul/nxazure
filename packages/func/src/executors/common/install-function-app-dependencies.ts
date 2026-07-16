import { detectPackageManager, ExecutorContext, getPackageManagerCommand } from '@nx/devkit';
import { execSync } from 'child_process';

const getPackageInstallCommand = () => {
  const rawInstallCommand = getPackageManagerCommand().install;

  const packageManager = detectPackageManager();
  return packageManager === 'pnpm' ? `${rawInstallCommand} --node-linker=hoisted --ignore-workspace` : rawInstallCommand;
};

export const installFunctionAppDependencies = (context: Pick<ExecutorContext, 'isVerbose' | 'target'>, appRoot: string) => {
  const installCommand = getPackageInstallCommand();
  if (context.isVerbose) console.log(`Running ${context.target?.executor} command: ${installCommand}.`);
  execSync(installCommand, { stdio: 'inherit', cwd: appRoot });
};
