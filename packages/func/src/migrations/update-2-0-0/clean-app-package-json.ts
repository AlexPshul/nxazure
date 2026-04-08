import { getProjects, Tree, updateJson } from '@nx/devkit';
import path from 'path';
import { color, FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  ScriptTarget,
  SyntaxKind,
  type Node,
} from 'typescript';

const isPackageModuleSpecifier = (moduleName: string) =>
  !moduleName.startsWith('.') && !moduleName.startsWith('node:') && !path.isAbsolute(moduleName);

const resolveMatchingDependency = (dependencies: Record<string, string>, moduleSpecifier: string): string | undefined => {
  if (dependencies[moduleSpecifier]) return moduleSpecifier;

  const lastSlashIndex = moduleSpecifier.lastIndexOf('/');
  if (lastSlashIndex === -1) return undefined;

  return resolveMatchingDependency(dependencies, moduleSpecifier.substring(0, lastSlashIndex));
};

const collectImportsFromSource = (sourceText: string, fileName: string) => {
  const imports = new Set<string>();
  const sourceFile = createSourceFile(fileName, sourceText, ScriptTarget.Latest, false);

  const visit = (node: Node) => {
    if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier) && isPackageModuleSpecifier(node.moduleSpecifier.text))
      imports.add(node.moduleSpecifier.text);

    if (
      isExportDeclaration(node) &&
      node.moduleSpecifier &&
      isStringLiteral(node.moduleSpecifier) &&
      isPackageModuleSpecifier(node.moduleSpecifier.text)
    )
      imports.add(node.moduleSpecifier.text);

    if (
      isCallExpression(node) &&
      node.arguments.length === 1 &&
      isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === SyntaxKind.ImportKeyword || (isIdentifier(node.expression) && node.expression.text === 'require')) &&
      isPackageModuleSpecifier(node.arguments[0].text)
    )
      imports.add(node.arguments[0].text);

    forEachChild(node, visit);
  };

  visit(sourceFile);
  return imports;
};

const collectAllProjectImports = (tree: Tree, projectRoot: string) => {
  const importedPackages = new Set<string>();

  const walkDirectory = (dirPath: string) => {
    if (!tree.exists(dirPath)) return;

    for (const child of tree.children(dirPath)) {
      const childPath = `${dirPath}/${child}`;
      if (tree.isFile(childPath)) {
        if (!child.endsWith('.ts') && !child.endsWith('.tsx')) continue;
        if (child.endsWith('.spec.ts') || child.endsWith('.test.ts')) continue;

        const sourceText = tree.read(childPath, 'utf-8');
        if (!sourceText) continue;

        for (const specifier of collectImportsFromSource(sourceText, child)) {
          importedPackages.add(specifier);
        }
      } else {
        walkDirectory(childPath);
      }
    }
  };

  walkDirectory(`${projectRoot}/src`);
  return importedPackages;
};

type PackageJson = { dependencies?: Record<string, string>; type?: string };

const cleanAppPackageJsonForProject = (tree: Tree, projectRoot: string) => {
  const packageJsonPath = `${projectRoot}/package.json`;
  if (!tree.exists(packageJsonPath)) {
    console.warn(
      color.warn('WARNING'),
      `Project at [${projectRoot}] has no package.json. Without it, the app won't be publishable to Azure natively.`,
    );
    return;
  }

  const importedSpecifiers = collectAllProjectImports(tree, projectRoot);

  updateJson<PackageJson>(tree, packageJsonPath, packageJson => {
    const currentDeps = packageJson.dependencies ?? {};

    for (const specifier of importedSpecifiers) {
      const matchedDep = resolveMatchingDependency(currentDeps, specifier);
      if (matchedDep) delete currentDeps[matchedDep];
    }

    packageJson.dependencies = currentDeps;
    packageJson.type = 'module';
    return packageJson;
  });
};

const cleanAppPackageJson = (tree: Tree) => {
  for (const [, project] of getProjects(tree)) {
    const hasFuncBuild = Object.values(project.targets ?? {}).some(
      target => target.executor === `${GLOBAL_NAME}/${FUNC_PACKAGE_NAME}:build`,
    );
    if (hasFuncBuild) cleanAppPackageJsonForProject(tree, project.root);
  }
};

export default cleanAppPackageJson;
