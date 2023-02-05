import { Executor } from '@nrwl/devkit';
import { build } from '../common/utils';

const executor: Executor = async (_, context) => ({ success: build(context) });
export default executor;
