import { StartExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nrwl/devkit';

const options: StartExecutorSchema = { port: 7071 };
const executorContext: ExecutorContext = {} as ExecutorContext;

describe('Start Executor', () => {
  it('can run', async () => {
    const output = await executor(options, executorContext);
    expect(output).toHaveProperty('success');
  });
});
