import { ExecutorContext } from '@nx/devkit';
import { readTsConfig } from '@nx/workspace/src/utilities/ts-config';
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
import { getCopyPackageToAppTransformerFactory } from './get-copy-package-to-app-transformer-factory';
import { injectPathRegistration } from './inject-path-registration';
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

type ProgressContext = {
  projectName: string;
  appRoot: string;
  outputPath: string;
};

const reportProgress = async (
  { appRoot, outputPath, projectName }: ProgressContext,
  diagnostic: Diagnostic,
  errors: number,
  onBuild?: () => void,
) => {
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
        await injectPathRegistration(outputPath, appRoot);
        console.log(color.info(`[${projectName}]`), formatDiagnosticsWithColorAndContext([diagnostic], formatHost));
        onBuild?.();
      }
      break;
  }
};

export const watch = async (context: ExecutorContext, onBuild?: () => void, onError?: () => void) => {
  const { appRoot, options } = prepareBuild(context);

  const progressContext: ProgressContext = {
    projectName: context.projectName,
    appRoot,
    outputPath: options.outputPath,
  };

  const config = readTsConfig(options.tsConfig);

  const host = createWatchCompilerHost(
    config.fileNames,
    { ...config.options, ...options, noEmitOnError: true },
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
      customTransformers.before.push(getCopyPackageToAppTransformerFactory(context));

      return originalProgramEmit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
    };

    originalAfterProgramCreate?.(builderProgram);
  };

  createWatchProgram(host);
};
