import fs from 'fs';
import path from 'path';
import { color } from '../../common/utils';

type PackageJson = { dependencies?: Record<string, string> };

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

const createTemporaryPackageJson = (appPackage: PackageJson, workspace: PackageJson, collectedPackages: string[]) => {
  const workspaceDependencies = workspace.dependencies ?? {};
  const missingDependencies = collectedPackages.reduce<string[]>((resolvedDependencies, moduleSpecifier) => {
    const dependencyName = resolveWorkspaceDependency(workspaceDependencies, moduleSpecifier);
    if (!dependencyName || appPackage.dependencies?.[dependencyName] || resolvedDependencies.includes(dependencyName))
      return resolvedDependencies;

    resolvedDependencies.push(dependencyName);
    return resolvedDependencies;
  }, []);

  if (missingDependencies.length === 0) return null;

  const temporaryPackageJson = { ...appPackage, dependencies: appPackage.dependencies ? { ...appPackage.dependencies } : {} };

  missingDependencies.forEach(dependencyName => {
    const workspaceDependency = workspaceDependencies[dependencyName];
    if (!workspaceDependency) return;

    temporaryPackageJson.dependencies[dependencyName] = workspaceDependency;
    console.log(color.fade(`Package [${dependencyName}@${workspaceDependency}] copied to app package.json`));
  });

  return temporaryPackageJson;
};

export const createTemporaryAppPackageJsonManager = (workspaceRoot: string, appRoot: string, collectedPackages: string[]) => {
  const appPackageJson = readPackageJson(appRoot);
  const workspacePackageJson = readPackageJson(workspaceRoot);

  const temporaryPackageJson = createTemporaryPackageJson(appPackageJson.parsed, workspacePackageJson.parsed, collectedPackages);

  let packageJsonTemporarilyUpdated = false;

  return {
    apply() {
      if (!temporaryPackageJson) return false;

      fs.writeFileSync(appPackageJson.fullPath, `${JSON.stringify(temporaryPackageJson, null, 2)}\n`);
      packageJsonTemporarilyUpdated = true;
      return true;
    },
    restore() {
      if (!packageJsonTemporarilyUpdated) return;

      fs.writeFileSync(appPackageJson.fullPath, appPackageJson.raw);
    },
  };
};
