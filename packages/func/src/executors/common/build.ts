import { ExecutorContext, logger } from '@nx/devkit';
import fs from 'fs';
import { createCompilerHost, createProgram } from 'typescript';
import { copyAssetsIfConfigured } from './copy-assets';
import { formatDiagnostics } from './format-diagnostics';
import { getRuntimeModuleTransformerFactory } from './get-runtime-module-transformer-factory';
import { CompileOptions, prepareBuild } from './prepare-build';

// Adapted from Nx's TypeScript compilation utility for Azure Functions builds.
const compileTypeScript = (compileOptions: CompileOptions, context: ExecutorContext) => {
  const tsConfig = compileOptions.parsedTsConfig;
  fs.rmSync(compileOptions.parsedTsConfig.options.outDir, { recursive: true, force: true });
  const host = createCompilerHost(tsConfig.options);
  const program = createProgram({ rootNames: tsConfig.fileNames, options: tsConfig.options, host });

  logger.info(`<⚡> ["${compileOptions.projectName}"] Compiling...`);

  const result = program.emit(undefined, undefined, undefined, undefined, {
    before: [getRuntimeModuleTransformerFactory(context, program)],
  });

  if (result.emitSkipped) {
    logger.error(formatDiagnostics(result.diagnostics));
    return { success: false };
  }

  logger.info(`<⚡> ["${compileOptions.projectName}"] Build is ready.`);
  return { success: true };
};

export const build = async (context: ExecutorContext) => {
  const { appRoot, options } = prepareBuild(context);

  const { success } = compileTypeScript(options, context);
  if (!success) return success;

  await copyAssetsIfConfigured(context, appRoot, options.parsedTsConfig.options.outDir);

  return success;
};
