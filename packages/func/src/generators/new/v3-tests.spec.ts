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

const templates = [
  ['Azure Blob Storage trigger', 'Blob', 'blob'],
  ['Durable Functions activity (V3 only)', 'DurableFunctionsActivity', 'durable-functions-activity'],
  ['Durable Functions entity', 'DurableFunctionsEntity', 'durable-functions-entity'],
  ['Durable Functions Entity HTTP starter (V3 only)', 'DurableFunctionsEntityHttpStart', 'durable-functions-entity-http-start'],
  ['Durable Functions HTTP starter (V3 only)', 'DurableFunctionsHttpStart', 'durable-functions-http-start'],
  ['Durable Functions orchestrator', 'DurableFunctionsOrchestrator', 'durable-functions-orchestrator'],
  ['Azure Event Grid trigger', 'EventGrid', 'event-grid'],
  ['Azure Event Hub trigger', 'EventHub', 'event-hub'],
  ['HTTP trigger', 'Http', 'http'],
  ['IoT Hub (Event Hub) (V3 only)', 'IotHub', 'iot-hub'],
  ['Kafka output (V3 only)', 'KafkaOutput', 'kafka-output'],
  ['Kafka trigger (V3 only)', 'KafkaTrigger', 'kafka-trigger'],
  ['Azure Queue Storage trigger', 'Queue', 'queue'],
  ['RabbitMQ trigger (V3 only)', 'RabbitMq', 'rabbit-mq'],
  ['SendGrid (V3 only)', 'SendGrid', 'send-grid'],
  ['Azure Service Bus Queue trigger', 'ServiceBusQueue', 'service-bus-queue'],
  ['Azure Service Bus Topic trigger', 'ServiceBusTopic', 'service-bus-topic'],
  ['SignalR negotiate HTTP trigger (V3 only)', 'SignalRNegotiate', 'signal-rnegotiate'],
  ['Timer trigger', 'Timer', 'timer'],
] as const;

describe('new generator (V3)', () => {
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
    await initProjecteGenerator(appTree, { name: projectName, strict: true, silent: true, v4: false, tags: '' });
  });

  it.each(templates)('%s template function', async (template, name, directory) => {
    await generator(appTree, { ...options, template, name });
    appTree.exists(`apps/${projectName}/${directory}/index.ts`);
    appTree.exists(`apps/${projectName}/${directory}/function.json`);
  });

  it('Unexisting template', async () => {
    const template = 'Unexisting template';
    expect(generator(appTree, { ...options, template })).rejects.toThrowError(`Template [${template}] is not supported.`);
  });
});
