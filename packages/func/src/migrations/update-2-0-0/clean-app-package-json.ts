import { getProjects, Tree, updateJson } from '@nx/devkit';
import path from 'path';
import { color, FUNC_PACKAGE_NAME, GLOBAL_NAME } from '../../common';
import {
  createCompilerHost,
  createProgram,
  formatDiagnosticsWithColorAndContext,
  getParsedCommandLineOfConfigFile,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  sys,
  SyntaxKind,
  visitEachChild,
  type Diagnostic,
  type SourceFile,
  type TransformerFactory,
  type Visitor,
} from 'typescript';

// ── Frozen helpers (copied inline so future refactors cannot alter this migration) ──

const isPackageModuleSpecifier = (moduleName: string) =>
  !moduleName.startsWith('.') && !moduleName.startsWith('node:') && !path.isAbsolute(moduleName);

const resolveMatchingDependency = (dependencies: Record<string, string>, moduleSpecifier: string): string | undefined => {
  if (dependencies[moduleSpecifier]) return moduleSpecifier;

  const lastSlashIndex = moduleSpecifier.lastIndexOf('/');
  if (lastSlashIndex === -1) return undefined;

  return resolveMatchingDependency(dependencies, moduleSpecifier.substring(0, lastSlashIndex));
};

const formatDiagnostics = (diagnostics: readonly Diagnostic[]) =>
  formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: sys.getCurrentDirectory,
    getNewLine: () => sys.newLine,
  });

// ── TypeScript compilation-based import collection ──

const createPackageCollectorTransformerFactory = (collected: Set<string>): TransformerFactory<SourceFile> => {
  return transformationContext => sourceFile => {
    const visitChild: Visitor = node => {
      if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier) && isPackageModuleSpecifier(node.moduleSpecifier.text))
        collected.add(node.moduleSpecifier.text);

      if (
        isExportDeclaration(node) &&
        node.moduleSpecifier &&
        isStringLiteral(node.moduleSpecifier) &&
        isPackageModuleSpecifier(node.moduleSpecifier.text)
      )
        collected.add(node.moduleSpecifier.text);

      if (
        isCallExpression(node) &&
        node.arguments.length === 1 &&
        isStringLiteral(node.arguments[0]) &&
        (node.expression.kind === SyntaxKind.ImportKeyword || (isIdentifier(node.expression) && node.expression.text === 'require')) &&
        isPackageModuleSpecifier(node.arguments[0].text)
      )
        collected.add(node.arguments[0].text);

      return visitEachChild(node, visitChild, transformationContext);
    };

    return visitEachChild(sourceFile, visitChild, transformationContext);
  };
};

const collectImportsViaCompiler = (absoluteProjectRoot: string): Set<string> | null => {
  const tsConfigPath = path.join(absoluteProjectRoot, 'tsconfig.json');

  const parsedConfig = getParsedCommandLineOfConfigFile(
    tsConfigPath,
    {},
    {
      ...sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic: Diagnostic) => {
        console.warn(color.warn('WARNING'), formatDiagnostics([diagnostic]));
      },
    },
  );

  if (!parsedConfig) return null;

  const options = { ...parsedConfig.options, noEmitOnError: false };
  const host = createCompilerHost(options);
  const program = createProgram({ rootNames: parsedConfig.fileNames, options, host });

  const collected = new Set<string>();
  program.emit(undefined, undefined, undefined, undefined, { before: [createPackageCollectorTransformerFactory(collected)] });

  return collected;
};

// ── Migration entry point ──

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

  const absoluteProjectRoot = path.resolve(tree.root, projectRoot);
  const importedSpecifiers = collectImportsViaCompiler(absoluteProjectRoot);

  if (!importedSpecifiers) {
    console.warn(color.warn('WARNING'), `Could not compile project at [${projectRoot}]. Skipping package.json cleanup.`);
    return;
  }

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
