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
  ['Azure Cosmos DB trigger', 'CosmosDb', 'cosmos-db'],
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

const unsupportedTemplates = [
  'Durable Functions activity (V3 only)',
  'Durable Functions Entity HTTP starter (V3 only)',
  'Durable Functions HTTP starter (V3 only)',
  'IoT Hub (Event Hub) (V3 only)',
  'Kafka output (V3 only)',
  'Kafka trigger (V3 only)',
  'RabbitMQ trigger (V3 only)',
  'SendGrid (V3 only)',
  'SignalR negotiate HTTP trigger (V3 only)',
];

describe('new generator (V4)', () => {
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
    await initProjecteGenerator(appTree, { name: projectName, strict: true, silent: true, v4: true });
  }, 120000);

  it.each(supportedTemplates)('%s supported template function', async (template, name, fileName) => {
    await generator(appTree, { ...options, template, name });
    appTree.exists(`apps/${projectName}/src/functions/${fileName}.ts`);
  });

  it.each(unsupportedTemplates)('%s unsupported V3 template function', async template => {
    expect(generator(appTree, { ...options, template, name: 'unsupported-test' })).rejects.toThrowError(
      `Template [${template}] is not supported in V4.`,
    );
  });

  it('Non existing template', async () => {
    const template = 'Non existing template';
    expect(generator(appTree, { ...options, template, name: 'non-existing-test' })).rejects.toThrowError(
      `Template [${template}] is not supported.`,
    );
  });
});
