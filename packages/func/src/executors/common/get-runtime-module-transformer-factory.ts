import { ExecutorContext } from '@nx/devkit';
import {
  SyntaxKind,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  visitEachChild,
  type Program,
  type SourceFile,
  type TransformerFactory,
  type Visitor,
} from 'typescript';
import { createRuntimeModuleSpecifierRewriter } from './rewrite-runtime-module-specifier';

export const getRuntimeModuleTransformerFactory = (context: ExecutorContext, program: Program) => {
  const compilerOptions = program.getCompilerOptions();
  const rewriteModuleSpecifier = createRuntimeModuleSpecifierRewriter(context, compilerOptions);

  const runtimeModuleTransformer: TransformerFactory<SourceFile> = transformationContext => {
    const factory = transformationContext.factory;

    return sourceFile => {
      const visitChild: Visitor = node => {
        // Example: import { lvl1lib } from 'lvl1lib';
        if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) {
          const rewrittenModuleSpecifier = rewriteModuleSpecifier(node.moduleSpecifier.text, sourceFile.fileName);
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
          const rewrittenModuleSpecifier = rewriteModuleSpecifier(node.moduleSpecifier.text, sourceFile.fileName);
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
          const rewrittenModuleSpecifier = rewriteModuleSpecifier(node.arguments[0].text, sourceFile.fileName);
          if (rewrittenModuleSpecifier) {
            return factory.updateCallExpression(node, node.expression, node.typeArguments, [
              factory.createStringLiteral(rewrittenModuleSpecifier),
            ]);
          }
        }

        return visitEachChild(node, visitChild, transformationContext);
      };

      return visitEachChild(sourceFile, visitChild, transformationContext);
    };
  };

  return runtimeModuleTransformer;
};
