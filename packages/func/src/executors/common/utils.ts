import path from 'path';
import ts from 'typescript';

export type CompileOptions = { outputPath: string; projectName: string; projectRoot: string; tsConfig: string };

export const formatDiagnostics = (diagnostics: readonly ts.Diagnostic[]) => {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  });
};

export const readTsConfig = (tsConfigPath: string) => {
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error]));
  }

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsConfigPath));
};

export const getNormalizedTsConfig = (compileOptions: CompileOptions) => {
  const parsedConfig = readTsConfig(compileOptions.tsConfig);
  parsedConfig.options.outDir = compileOptions.outputPath;
  parsedConfig.options.noEmitOnError = true;
  parsedConfig.options.rootDir = compileOptions.projectRoot;

  if (parsedConfig.options.incremental && !parsedConfig.options.tsBuildInfoFile) {
    parsedConfig.options.tsBuildInfoFile = path.join(compileOptions.outputPath, 'tsconfig.tsbuildinfo');
  }

  return parsedConfig;
};
