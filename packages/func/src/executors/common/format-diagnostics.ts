import { type Diagnostic, formatDiagnosticsWithColorAndContext, sys } from 'typescript';

export const formatDiagnostics = (diagnostics: readonly Diagnostic[]) => {
  return formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: sys.getCurrentDirectory,
    getNewLine: () => sys.newLine,
  });
};
