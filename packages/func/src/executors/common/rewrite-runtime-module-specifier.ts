import { ExecutorContext } from '@nx/devkit';
import path from 'path';
import { createModuleResolutionCache, resolveModuleName, sys, type CompilerOptions } from 'typescript';

const shouldResolveModuleSpecifier = (moduleName: string) => !moduleName.startsWith('node:') && !path.isAbsolute(moduleName);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesPathAliasPattern = (moduleName: string, compilerPaths: CompilerOptions['paths']) =>
  Object.keys(compilerPaths ?? {}).some(pattern => {
    const patternRegex = new RegExp(`^${escapeRegExp(pattern).replace(/\\\*/g, '.*')}$`);
    return patternRegex.test(moduleName);
  });

const getEmittedExtension = (fileName: string) => {
  const normalized = fileName.toLowerCase();

  if (normalized.endsWith('.d.ts') || normalized.endsWith('.d.mts') || normalized.endsWith('.d.cts')) return null;

  switch (path.extname(normalized)) {
    case '.mts':
    case '.mjs':
      return '.mjs';
    case '.cts':
    case '.cjs':
      return '.cjs';
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
      return '.js';
    default:
      return null;
  }
};

const getOutputFilePath = (workspaceRoot: string, compilerOptions: CompilerOptions, fileName: string) => {
  const emittedExtension = getEmittedExtension(fileName);
  if (!emittedExtension) return null;

  const rootDir = path.resolve(workspaceRoot, compilerOptions.rootDir ?? '.');
  const outDir = path.resolve(workspaceRoot, compilerOptions.outDir ?? '.');
  const absoluteFileName = path.resolve(fileName);
  const relativePath = path.relative(rootDir, absoluteFileName);
  if (relativePath.startsWith('..')) return null;

  return path.join(outDir, relativePath.slice(0, -path.extname(relativePath).length) + emittedExtension);
};

const toOutputModuleSpecifier = (
  workspaceRoot: string,
  compilerOptions: CompilerOptions,
  sourceFileName: string,
  targetFileName: string,
) => {
  const sourceOutputPath = getOutputFilePath(workspaceRoot, compilerOptions, sourceFileName);
  const targetOutputPath = getOutputFilePath(workspaceRoot, compilerOptions, targetFileName);
  if (!sourceOutputPath || !targetOutputPath) return null;

  const relativePath = path.relative(path.dirname(sourceOutputPath), targetOutputPath).replace(/\\/g, '/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
};

export const createRuntimeModuleSpecifierRewriter = (context: ExecutorContext, compilerOptions: CompilerOptions) => {
  const compilerPaths = compilerOptions.paths ?? {};
  const moduleResolutionCache = createModuleResolutionCache(
    context.cwd,
    fileName => (sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
    compilerOptions,
  );
  const workspaceRoot = path.resolve(context.cwd);

  const rewriteModuleSpecifier = (moduleName: string, sourceFileName: string) => {
    if (!shouldResolveModuleSpecifier(moduleName)) return null;

    const resolvedModule = resolveModuleName(moduleName, sourceFileName, compilerOptions, sys, moduleResolutionCache).resolvedModule;
    if (!resolvedModule?.resolvedFileName) return null;

    const resolvedFileName = path.resolve(resolvedModule.resolvedFileName);
    if (!resolvedFileName.startsWith(`${workspaceRoot}${path.sep}`)) return null;
    if (resolvedFileName.includes(`${path.sep}node_modules${path.sep}`)) return null;

    return toOutputModuleSpecifier(workspaceRoot, compilerOptions, sourceFileName, resolvedFileName);
  };

  return (moduleName: string, sourceFileName: string) => {
    if (matchesPathAliasPattern(moduleName, compilerPaths)) return rewriteModuleSpecifier(moduleName, sourceFileName);

    // ESM runtime still needs explicit file extensions for relative workspace imports/exports.
    if (moduleName.startsWith('.')) return rewriteModuleSpecifier(moduleName, sourceFileName);

    return null;
  };
};
