import path from 'path';
import { ScriptTarget, createSourceFile, transform, type SourceFile, type TransformerFactory } from 'typescript';
import { createRuntimePackageCollector } from './runtime-package-collector';

const collectPackages = (source: string, fileName = path.join(process.cwd(), 'dist', 'apps', 'demo-app', 'handler.js')) => {
  const collector = createRuntimePackageCollector();
  const afterTransformers = (collector.customTransformers.after ?? []) as TransformerFactory<SourceFile>[];
  let sourceFile = createSourceFile(fileName, source, ScriptTarget.Latest, true);

  afterTransformers.forEach(transformer => {
    const result = transform(sourceFile, [transformer]);
    sourceFile = result.transformed[0] as SourceFile;
    result.dispose();
  });

  return collector.getCollectedPackages().sort();
};

describe('runtime package collector', () => {
  it('collects runtime package imports from emitted JavaScript shapes', () => {
    const packages = collectPackages(
      [
        "import alpha from 'alpha';",
        "export { betaValue } from 'beta/subpath';",
        "const gammaValue = require('gamma/subpath');",
        "const scopedValue = require('@scope/pkg/internal');",
        'async function load() {',
        "  const dynamicValue = await import('delta');",
        "  const builtinValue = await import('node:fs');",
        "  const relativeValue = await import('./local.js');",
        "  const absoluteValue = await import('/absolute/path.js');",
        '  void dynamicValue;',
        '  void builtinValue;',
        '  void relativeValue;',
        '  void absoluteValue;',
        '}',
        "import anotherAlpha from 'alpha';",
        'void alpha;',
        'void betaValue;',
        'void gammaValue;',
        'void scopedValue;',
        'void anotherAlpha;',
        'void load;',
      ].join('\n'),
    );

    expect(packages).toEqual(['@scope/pkg/internal', 'alpha', 'beta/subpath', 'delta', 'gamma/subpath']);
  });

  it('ignores files without package imports', () => {
    const packages = collectPackages(
      [
        "import { localValue } from './local.js';",
        "export { otherValue } from './other.js';",
        "const config = require('./config.json');",
        'void localValue;',
        'void otherValue;',
        'void config;',
      ].join('\n'),
    );

    expect(packages).toEqual([]);
  });
});
