import path from 'path';
import {
  SyntaxKind,
  forEachChild,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  type Node,
  type SourceFile,
  type TransformerFactory,
} from 'typescript';

const isPackageModuleSpecifier = (moduleName: string) =>
  !moduleName.startsWith('.') && !moduleName.startsWith('node:') && !path.isAbsolute(moduleName);

export const createRuntimePackageCollector = () => {
  const importedPackages = new Set<string>();

  const runtimePackageCollector: TransformerFactory<SourceFile> = () => sourceFile => {
    const visit = (node: Node) => {
      // Catches static imports like: import x from 'pkg'
      if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier) && isPackageModuleSpecifier(node.moduleSpecifier.text)) {
        importedPackages.add(node.moduleSpecifier.text);
      }

      // Catches re-exports like: export { x } from 'pkg'
      if (
        isExportDeclaration(node) &&
        node.moduleSpecifier &&
        isStringLiteral(node.moduleSpecifier) &&
        isPackageModuleSpecifier(node.moduleSpecifier.text)
      ) {
        importedPackages.add(node.moduleSpecifier.text);
      }

      // Catches require/import calls like: require('pkg') and import('pkg')
      if (
        isCallExpression(node) &&
        node.arguments.length === 1 &&
        isStringLiteral(node.arguments[0]) &&
        (node.expression.kind === SyntaxKind.ImportKeyword || (isIdentifier(node.expression) && node.expression.text === 'require')) &&
        isPackageModuleSpecifier(node.arguments[0].text)
      ) {
        importedPackages.add(node.arguments[0].text);
      }

      forEachChild(node, visit);
    };

    visit(sourceFile);
    return sourceFile;
  };

  return {
    customTransformers: { after: [runtimePackageCollector] },
    getCollectedPackages: () => [...importedPackages],
  };
};
