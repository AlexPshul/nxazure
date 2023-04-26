import { StartExecutorSchema } from './schema';
import { Executor } from '@nrwl/devkit';
import { build } from '../common/utils';
import { execSync } from 'child_process';

const executor: Executor<StartExecutorSchema> = async (options, context) => {
  const success = build(context);

  if (success) {
    const cwd = context.workspace?.projects[context.projectName].root;

    const {
      port,
      cors,
      corsCredentials,
      timeout,
      useHttps,
      cert,
      password,
      languageWorker,
      noBuild,
      enableAuth,
      functions,
      verbose,
      dotnetIsolatedDebug,
      enableJsonOutput,
      jsonOutputFile,
    } = options;

    const args = [
      { flag: '--port', value: port },
      { flag: '--cors', value: cors },
      { flag: '--cors-credentials', value: corsCredentials },
      { flag: '--timeout', value: timeout },
      { flag: '--useHttps', value: useHttps },
      { flag: '--cert', value: cert, condition: useHttps },
      { flag: '--password', value: password, condition: cert },
      { flag: '--language-worker', value: languageWorker },
      { flag: '--no-build', value: noBuild },
      { flag: '--enableAuth', value: enableAuth },
      { flag: '--functions', value: functions },
      { flag: '--verbose', value: verbose },
      { flag: '--dotnet-isolated-debug', dotnetIsolatedDebug },
      { flag: '--enable-json-output', value: enableJsonOutput },
      { flag: '--json-output-file', value: jsonOutputFile, condition: enableJsonOutput },
    ];

    const command = args
      .filter(arg => arg.value && (!arg.condition || arg.condition))
      .map(arg => `${arg.flag} ${arg.value}`)
      .join(' ');

    execSync(`func start ${command}`, {
      cwd,
      stdio: 'inherit',
    });
  }

  return { success };
};

export default executor;
