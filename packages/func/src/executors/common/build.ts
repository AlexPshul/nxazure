import { ExecutorContext } from '@nx/devkit';
import { compileTypeScript } from '@nx/workspace/src/utilities/typescript/compilation';
import { getCopyPackageToAppTransformerFactory } from './get-copy-package-to-app-transformer-factory';
import { injectPathRegistration } from './inject-path-registration';
import { prepareBuild } from './prepare-build';

export const build = async (context: ExecutorContext) => {
  const { appRoot, options } = prepareBuild(context);

  const { success } = compileTypeScript({
    ...options,
    getCustomTransformers: () => ({
      before: [getCopyPackageToAppTransformerFactory(context)],
    }),
  });

  await injectPathRegistration(options.outputPath, appRoot);

  return success;
};
