import { BuildExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nrwl/devkit';

const options: BuildExecutorSchema = {};
const executorContext: ExecutorContext = {} as ExecutorContext;

describe('Build Executor', () => {
  it('can run', async () => {
    const output = await executor(options, executorContext);
    expect(output).toHaveProperty('success');
  });
});
