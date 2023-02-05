import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree, readProjectConfiguration } from '@nrwl/devkit';

import generator from './generator';
import { NewGeneratorSchema } from './schema';

describe('new generator', () => {
  let appTree: Tree;
  const options: NewGeneratorSchema = {
    project: 'test-project',
    name: 'test-func',
    language: 'TypeScript',
    template: 'HTTP trigger',
    authLevel: 'anonymous',
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'test');
    expect(config).toBeDefined();
  });
});
