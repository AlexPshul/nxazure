import fs from 'fs';
import path from 'path';
import { color } from '../../common/utils';

type PackageJson = { dependencies?: Record<string, string>; [key: string]: unknown };

const readPackageJson = (rootPath: string) => {
  const fullPath = path.join(rootPath, 'package.json');
  const raw = fs.readFileSync(fullPath, 'utf-8');

  return {
    fullPath,
    raw,
    parsed: JSON.parse(raw) as PackageJson,
  };
};

const resolveWorkspaceDependency = (workspaceDependencies: Record<string, string>, moduleSpecifier: string): string | undefined => {
  if (workspaceDependencies[moduleSpecifier]) return moduleSpecifier;

  const lastSlashIndex = moduleSpecifier.lastIndexOf('/');
  if (lastSlashIndex === -1) return undefined;

  return resolveWorkspaceDependency(workspaceDependencies, moduleSpecifier.substring(0, lastSlashIndex));
};

const createSyncedPackageJson = (appPackage: PackageJson, workspace: PackageJson, collectedPackages: string[]) => {
  const workspaceDependencies = workspace.dependencies ?? {};
  const missingDependencies = collectedPackages.reduce<string[]>((resolvedDependencies, moduleSpecifier) => {
    const dependencyName = resolveWorkspaceDependency(workspaceDependencies, moduleSpecifier);
    if (!dependencyName || appPackage.dependencies?.[dependencyName] || resolvedDependencies.includes(dependencyName))
      return resolvedDependencies;

    resolvedDependencies.push(dependencyName);
    return resolvedDependencies;
  }, []);

  if (missingDependencies.length === 0) return null;

  const syncedPackageJson: PackageJson & { dependencies: Record<string, string> } = {
    ...appPackage,
    dependencies: { ...(appPackage.dependencies ?? {}) },
  };

  missingDependencies.forEach(dependencyName => {
    const workspaceDependency = workspaceDependencies[dependencyName];
    if (!workspaceDependency) return;

    syncedPackageJson.dependencies[dependencyName] = workspaceDependency;
    console.log(color.fade(`Package [${dependencyName}@${workspaceDependency}] copied to app package.json`));
  });

  return syncedPackageJson;
};

export const createPackageJsonDependencySync = (workspaceRoot: string, appRoot: string, collectedPackages: string[]) => {
  const appPackageJson = readPackageJson(appRoot);
  const workspacePackageJson = readPackageJson(workspaceRoot);

  const syncedPackageJson = createSyncedPackageJson(appPackageJson.parsed, workspacePackageJson.parsed, collectedPackages);

  let packageJsonUpdated = false;

  return {
    apply() {
      if (!syncedPackageJson) return false;

      fs.writeFileSync(appPackageJson.fullPath, `${JSON.stringify(syncedPackageJson, null, 2)}\n`);
      packageJsonUpdated = true;
      return true;
    },
    restore() {
      if (!packageJsonUpdated) return;

      fs.writeFileSync(appPackageJson.fullPath, appPackageJson.raw);
    },
  };
};
