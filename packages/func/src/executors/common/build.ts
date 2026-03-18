import { ExecutorContext, logger } from '@nx/devkit';
import fs from 'fs';
import ts from 'typescript';
import { copyAssetsIfConfigured } from './copy-assets';
import { getCopyPackageToAppTransformerFactory } from './get-copy-package-to-app-transformer-factory';
import { injectPathRegistration } from './inject-path-registration';
import { prepareBuild } from './prepare-build';
import { CompileOptions, formatDiagnostics, getNormalizedTsConfig } from './utils';

// Adapted from Nx's TypeScript compilation utility for Azure Functions builds.
const compileTypeScript = (compileOptions: CompileOptions, context: ExecutorContext) => {
  const tsConfig = getNormalizedTsConfig(compileOptions);
  fs.rmSync(compileOptions.outputPath, { recursive: true, force: true });
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

  await injectPathRegistration(options.outputPath, appRoot);
  await copyAssetsIfConfigured(context, appRoot, options.outputPath);

  return success;
};
