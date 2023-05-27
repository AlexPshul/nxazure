import { Executor } from '@nx/devkit';
import { build } from '../common/build';

const executor: Executor = async (_, context) => ({ success: await build(context) });
export default executor;
