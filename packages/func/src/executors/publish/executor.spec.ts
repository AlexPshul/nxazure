import { PublishExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nrwl/devkit';

const options: PublishExecutorSchema = { name: 'test' };
const executorContext: ExecutorContext = {} as ExecutorContext;

describe('Publish Executor', () => {
  it('can run', async () => {
    const output = await executor(options, executorContext);
    expect(output).toHaveProperty('success');
  });
});
