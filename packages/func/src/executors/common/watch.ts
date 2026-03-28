import { ExecutorContext } from '@nx/devkit';
import fs from 'fs';
import {
  Diagnostic,
  FormatDiagnosticsHost,
  createSemanticDiagnosticsBuilderProgram,
  createWatchCompilerHost,
  createWatchProgram,
  formatDiagnosticsWithColorAndContext,
  sys,
} from 'typescript';
import { color } from '../../common';
import { copyAssetsIfConfigured } from './copy-assets';
import { getRuntimeModuleTransformerFactory } from './get-runtime-module-transformer-factory';
import { prepareBuild } from './prepare-build';

const formatHost: FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: sys.getCurrentDirectory,
  getNewLine: () => sys.newLine,
};

const reportErrorDiagnostics = (projectName: string, diagnostic: Diagnostic, externalOnError?: () => void) => {
  console.log(color.error(`[${projectName}]`), formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
  externalOnError?.();
};

type ProgressContext = { executorContext: ExecutorContext; appRoot: string; outputPath: string };

const reportProgress = async (
  { executorContext, appRoot, outputPath }: ProgressContext,
  diagnostic: Diagnostic,
  errors: number,
  onBuild?: () => void,
) => {
  const projectName = executorContext.projectName;
  switch (diagnostic.code) {
    case 6031: // When the build watch starts (only the first time) we delete the output folder
      fs.rmSync(outputPath, { recursive: true, force: true });
      break;
    case 6032: // File change detected. Starting incremental compilation...
      console.log(color.info(`[${projectName}]`), formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
      break;
    default:
      if (errors > 0) console.log(color.error(`[${projectName}]`), formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
      else {
        await copyAssetsIfConfigured(executorContext, appRoot, outputPath);
        console.log(color.info(`[${projectName}]`), formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
        onBuild?.();
      }
      break;
  }
};

export const watch = async (context: ExecutorContext, onBuild?: () => void, onError?: () => void) => {
  const { appRoot, options } = prepareBuild(context);
  const progressContext: ProgressContext = { executorContext: context, appRoot, outputPath: options.parsedTsConfig.options.outDir };
  const config = options.parsedTsConfig;

  const host = createWatchCompilerHost(
    config.fileNames,
    config.options,
    sys,
    createSemanticDiagnosticsBuilderProgram,
    diagnostic => reportErrorDiagnostics(context.projectName, diagnostic, onError),
    (diagnostic, _nl, _o, errors) => reportProgress(progressContext, diagnostic, errors, onBuild),
  );

  const originalAfterProgramCreate = host.afterProgramCreate;
  host.afterProgramCreate = builderProgram => {
    const originalProgramEmit = builderProgram.emit;
    builderProgram.emit = (targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers) => {
      if (!customTransformers) customTransformers = { before: [] };
      if (!customTransformers.before) customTransformers.before = [];
      customTransformers.before.push(getRuntimeModuleTransformerFactory(context, builderProgram.getProgram()));

      return originalProgramEmit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
    };

    originalAfterProgramCreate?.(builderProgram);
  };

  createWatchProgram(host);
};
