import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import initProjecteGenerator from '../init/generator';
import generator from './generator';
import { NewGeneratorSchema } from './schema';

jest.mock('@nx/devkit', () => {
  const originalModule = jest.requireActual('@nx/devkit');

  return {
    ...originalModule,
    installPackagesTask: jest.fn(() => console.log('Imagine installing packages here...')),
  };
});

const supportedTemplates = [
  ['Azure Blob Storage trigger', 'Blob', 'blob'],
  ['Azure Cosmos DB trigger', 'CosmosDB', 'cosmos-db'],
  ['Durable Functions entity', 'DurableFunctionsEntity', 'durable-functions-entity'],
  ['Durable Functions orchestrator', 'DurableFunctionsOrchestrator', 'durable-functions-orchestrator'],
  ['Azure Event Grid trigger', 'EventGrid', 'event-grid'],
  ['Azure Event Hub trigger', 'EventHub', 'event-hub'],
  ['HTTP trigger', 'Http', 'http'],
  ['Azure Queue Storage trigger', 'Queue', 'queue'],
  ['Azure Service Bus Queue trigger', 'ServiceBusQueue', 'service-bus-queue'],
  ['Azure Service Bus Topic trigger', 'ServiceBusTopic', 'service-bus-topic'],
  ['Timer trigger', 'Timer', 'timer'],
] as const;

const TEST_TIMEOUT = 120000;

describe('new generator', () => {
  const projectName = 'HelloWorld';
  let appTree: Tree;
  const options: NewGeneratorSchema = {
    project: projectName,
    name: 'test-func',
    language: 'TypeScript',
    template: 'HTTP trigger',
    authLevel: 'anonymous',
    silent: true,
  };

  beforeAll(async () => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await initProjecteGenerator(appTree, { name: projectName, strict: true, silent: true, tags: '' });
  }, TEST_TIMEOUT);

  it.each(supportedTemplates)('%s supported template function', async (template, name, fileName) => {
    await generator(appTree, { ...options, template, name });
    appTree.exists(`apps/${projectName}/src/functions/${fileName}.ts`);
  });

  it('Non existing template', async () => {
    const template = 'Non existing template';
    expect(generator(appTree, { ...options, template, name: 'non-existing-test' })).rejects.toThrowError(
      `Template [${template}] is not supported.`,
    );
  });
});
