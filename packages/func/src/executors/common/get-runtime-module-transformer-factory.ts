import { ExecutorContext } from '@nx/devkit';
import {
  SyntaxKind,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  type Program,
  type SourceFile,
  type TransformerFactory,
  type Visitor,
  visitEachChild,
} from 'typescript';
import { createAppPackageJsonUpdater } from './update-app-package-json';
import { createRuntimeModuleSpecifierRewriter } from './rewrite-runtime-module-specifier';

export const getRuntimeModuleTransformerFactory = (context: ExecutorContext, program: Program) => {
  const compilerOptions = program.getCompilerOptions();
  const rewriteModuleSpecifier = createRuntimeModuleSpecifierRewriter(context, compilerOptions);
  const appPackageJsonUpdater = createAppPackageJsonUpdater(context, compilerOptions);

  const runtimeModuleTransformer: TransformerFactory<SourceFile> = transformationContext => {
    const factory = transformationContext.factory;

    return sourceFile => {
      const maybeRewriteModuleSpecifier = (moduleName: string) => {
        const rewrittenModuleSpecifier = rewriteModuleSpecifier(moduleName, sourceFile.fileName);
        if (!rewrittenModuleSpecifier) appPackageJsonUpdater.handleModuleSpecifier(moduleName);

        return rewrittenModuleSpecifier;
      };

      const visitChild: Visitor = node => {
        // Example: import { lvl1lib } from 'lvl1lib';
        if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) {
          const rewrittenModuleSpecifier = maybeRewriteModuleSpecifier(node.moduleSpecifier.text);
          if (rewrittenModuleSpecifier) {
            return factory.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              factory.createStringLiteral(rewrittenModuleSpecifier),
              node.attributes,
            );
          }
        }

        // Example: export * from './lib/lvl1lib';
        if (isExportDeclaration(node) && node.moduleSpecifier && isStringLiteral(node.moduleSpecifier)) {
          const rewrittenModuleSpecifier = maybeRewriteModuleSpecifier(node.moduleSpecifier.text);
          if (rewrittenModuleSpecifier) {
            return factory.updateExportDeclaration(
              node,
              node.modifiers,
              node.isTypeOnly,
              node.exportClause,
              factory.createStringLiteral(rewrittenModuleSpecifier),
              node.attributes,
            );
          }
        }

        // Example: await import('lvl1lib') or require('lvl1lib');
        if (
          isCallExpression(node) &&
          node.arguments.length === 1 &&
          isStringLiteral(node.arguments[0]) &&
          (node.expression.kind === SyntaxKind.ImportKeyword || (isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
          const rewrittenModuleSpecifier = maybeRewriteModuleSpecifier(node.arguments[0].text);
          if (rewrittenModuleSpecifier) {
            return factory.updateCallExpression(node, node.expression, node.typeArguments, [
              factory.createStringLiteral(rewrittenModuleSpecifier),
            ]);
          }
        }

        return visitEachChild(node, visitChild, transformationContext);
      };

      const resultSourceFile = visitEachChild(sourceFile, visitChild, transformationContext);
      appPackageJsonUpdater.flush();

      return resultSourceFile;
    };
  };

  return runtimeModuleTransformer;
};
