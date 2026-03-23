import ts from 'typescript';

export const formatDiagnostics = (diagnostics: readonly ts.Diagnostic[]) => {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  });
};
