import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import initProjecteGenerator from '../init/generator';
import generator from './generator';
import { NewGeneratorSchema } from './schema';

jest.mock('@nrwl/devkit', () => {
  const originalModule = jest.requireActual('@nrwl/devkit');

  return {
    ...originalModule,
    installPackagesTask: jest.fn(() => console.log('Imagine installing packages here...')),
  };
});

const templates = [
  ['Azure Blob Storage trigger', 'Blob', 'blob'],
  ['Azure Cosmos DB trigger', 'CosmosDb', 'cosmos-db'],
  ['Durable Functions activity', 'DurableFunctionsActivity', 'durable-functions-activity'],
  ['Durable Functions entity', 'DurableFunctionsEntity', 'durable-functions-entity'],
  ['Durable Functions Entity HTTP starter', 'DurableFunctionsEntityHttpStart', 'durable-functions-entity-http-start'],
  ['Durable Functions HTTP starter', 'DurableFunctionsHttpStart', 'durable-functions-http-start'],
  ['Durable Functions orchestrator', 'DurableFunctionsOrchestrator', 'durable-functions-orchestrator'],
  ['Azure Event Grid trigger', 'EventGrid', 'event-grid'],
  ['Azure Event Hub trigger', 'EventHub', 'event-hub'],
  ['HTTP trigger', 'Http', 'http'],
  ['IoT Hub (Event Hub)', 'IotHub', 'iot-hub'],
  ['Kafka output', 'KafkaOutput', 'kafka-output'],
  ['Kafka trigger', 'KafkaTrigger', 'kafka-trigger'],
  ['Azure Queue Storage trigger', 'Queue', 'queue'],
  ['RabbitMQ trigger', 'RabbitMq', 'rabbit-mq'],
  ['SendGrid', 'SendGrid', 'send-grid'],
  ['Azure Service Bus Queue trigger', 'ServiceBusQueue', 'service-bus-queue'],
  ['Azure Service Bus Topic trigger', 'ServiceBusTopic', 'service-bus-topic'],
  ['SignalR negotiate HTTP trigger', 'SignalRNegotiate', 'signal-rnegotiate'],
  ['Timer trigger', 'Timer', 'timer'],
] as const;

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
    await initProjecteGenerator(appTree, { name: projectName, strict: true, silent: true, v4: false });
  });

  it.each(templates)('%s template function', async (template, name, directory) => {
    await generator(appTree, { ...options, template, name });
    appTree.exists(`apps/${projectName}/${directory}/index.ts`);
    appTree.exists(`apps/${projectName}/${directory}/function.json`);
  });
});
