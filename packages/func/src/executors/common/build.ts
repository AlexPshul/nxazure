import { ExecutorContext, logger } from '@nx/devkit';
import fs from 'fs';
import ts from 'typescript';
import { copyAssetsIfConfigured } from './copy-assets';
import { formatDiagnostics } from './format-diagnostics';
import { getCopyPackageToAppTransformerFactory } from './get-copy-package-to-app-transformer-factory';
import { injectPathRegistration } from './inject-path-registration';
import { CompileOptions, prepareBuild } from './prepare-build';

// Adapted from Nx's TypeScript compilation utility for Azure Functions builds.
const compileTypeScript = (compileOptions: CompileOptions, context: ExecutorContext) => {
  const tsConfig = compileOptions.parsedTsConfig;
  fs.rmSync(compileOptions.parsedTsConfig.options.outDir, { recursive: true, force: true });
  const host = ts.createCompilerHost(tsConfig.options);
  const program = ts.createProgram({ rootNames: tsConfig.fileNames, options: tsConfig.options, host });

  logger.info(`<⚡> ["${compileOptions.projectName}"] Compiling...`);

  const result = program.emit(undefined, undefined, undefined, undefined, { before: [getCopyPackageToAppTransformerFactory(context)] });

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

  await injectPathRegistration(options.parsedTsConfig.options.outDir, appRoot);
  await copyAssetsIfConfigured(context, appRoot, options.parsedTsConfig.options.outDir);

  return success;
};
