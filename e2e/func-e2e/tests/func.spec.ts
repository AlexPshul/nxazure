import { NxJsonConfiguration } from '@nx/devkit';
import {
  ensureNxProject,
  readJson,
  runCommand,
  runCommandAsync,
  runNxCommandAsync,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/plugin/testing';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import treeKill from 'tree-kill';

const lib1 = 'lvl1lib';
const lib2 = 'lvl2lib';
const TEST_TIMEOUT = 180000;
const WATCH_READY_MESSAGE = 'Found 0 errors. Watching for file changes.';
const WATCH_REBUILD_MESSAGE = 'File change detected. Starting incremental compilation...';
const FUNC_RUNTIME_READY_MESSAGE = 'For detailed output, run func with --verbose flag.';
const WORKER_READY_MESSAGE = 'Worker process started and initialized.';
const WATCH_READY_TIMEOUT = 60000;
const WATCH_REBUILD_TIMEOUT = 30000;
const WATCH_STABILITY_WINDOW = 5000;
const NPM_EXECUTABLE = process.platform === 'win32' ? 'npm.cmd' : 'npm';

type TsConfigMutator = (tsconfig: { compilerOptions?: Record<string, unknown> }) => void;
type PreparedProject = {
  directory: string;
  funcFilePath: string;
  project: string;
};

const tsConfigScenarios = [
  {
    name: 'legacy commonjs and es6 compiler options',
    compilerOptions: {
      module: 'commonjs',
      target: 'es6',
    },
  },
  {
    name: 'common modern node16 and es2022 compiler options',
    compilerOptions: {
      module: 'node16',
      moduleResolution: 'node16',
      target: 'es2022',
    },
  },
  {
    name: 'latest nodenext and esnext compiler options',
    compilerOptions: {
      module: 'nodenext',
      moduleDetection: 'force',
      moduleResolution: 'nodenext',
      resolvePackageJsonExports: true,
      resolvePackageJsonImports: true,
      target: 'esnext',
    },
  },
] satisfies {
  compilerOptions: Record<string, unknown>;
  name: string;
}[];

const setupWorkspace = async () => {
  process.env.CI = 'true';
  process.env.NX_DAEMON = 'false';
  process.env.NX_INTERACTIVE = 'false';

  console.log('Before all');
  ensureNxProject('@nxazure/func', 'dist/packages/func');
  runCommand('git init && git add -A', {});
  console.log('After ensureNxProject');

  const nxConfig = readJson<NxJsonConfiguration>('nx.json');
  nxConfig.workspaceLayout = { appsDir: 'apps', libsDir: 'libs' };

  updateFile('nx.json', JSON.stringify(nxConfig, null, 2));

  console.log('Installing types');
  runCommand('npm i @types/node@latest', {});

  console.log('Generating libraries');
  await runNxCommandAsync(`g @nx/js:library ${lib1} --directory=libs/${lib1} --bundler=none --linter=none --unitTestRunner=none`);
  await runNxCommandAsync(`g @nx/js:library ${lib2} --directory=libs/${lib2} --bundler=none --linter=none --unitTestRunner=none`);

  const libFilePath = `libs/${lib1}/src/lib/${lib1}.ts`;
  updateFile(
    libFilePath,
    `
import { ${lib2} } from '@proj/${lib2}';

export function ${lib1}(): string {
return ${lib2}();
}
      `,
  );
  console.log('Generated the libs and ready to test');
};

const resetWorkspace = async () => {
  await runNxCommandAsync('reset');
};

const sleep = (durationMs: number) => new Promise(resolve => setTimeout(resolve, durationMs));

const ANSI_ESCAPE_PREFIX = String.fromCharCode(27);

const stripAnsi = (value: string) => value.replace(new RegExp(`${ANSI_ESCAPE_PREFIX}\\[[0-9;]*m`, 'g'), '');

const countOccurrences = (value: string, needle: string) => value.split(needle).length - 1;

const getOccurrenceIndex = (value: string, needle: string, occurrence: number) => {
  if (occurrence < 1) return -1;

  let fromIndex = 0;

  for (let currentOccurrence = 1; currentOccurrence <= occurrence; currentOccurrence += 1) {
    const matchIndex = value.indexOf(needle, fromIndex);
    if (matchIndex === -1) return -1;
    if (currentOccurrence === occurrence) return matchIndex;

    fromIndex = matchIndex + needle.length;
  }

  return -1;
};

const getStartMessageCounts = (output: string) => ({
  ready: countOccurrences(output, WATCH_READY_MESSAGE),
  rebuild: countOccurrences(output, WATCH_REBUILD_MESSAGE),
  worker: countOccurrences(output, WORKER_READY_MESSAGE),
});

const getOutputTail = (output: string) => output.slice(-4000);

const getStartProcessEnv = () =>
  Object.fromEntries(
    Object.entries({
      ...process.env,
      CI: 'true',
      FORCE_COLOR: '0',
      NX_DAEMON: 'false',
      NX_INTERACTIVE: 'false',
    }).filter(([, value]) => value !== undefined),
  ) as NodeJS.ProcessEnv;

const waitForOutput = async (
  child: ChildProcessWithoutNullStreams,
  output: { value: string },
  predicate: (data: string) => boolean,
  description: string,
  timeoutMs: number,
) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (predicate(output.value)) return;

    if (child.exitCode !== null) {
      throw new Error(`Start process exited before ${description}.\nOutput tail:\n${getOutputTail(output.value)}`);
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${description}.\nOutput tail:\n${getOutputTail(output.value)}`);
};

const assertWatchMessagesAreStable = async (
  child: ChildProcessWithoutNullStreams,
  output: { value: string },
  expectedCounts: ReturnType<typeof getStartMessageCounts>,
  description: string,
) => {
  await sleep(WATCH_STABILITY_WINDOW);

  if (child.exitCode !== null) {
    throw new Error(`Start process exited while waiting for ${description}.\nOutput tail:\n${getOutputTail(output.value)}`);
  }

  expect(getStartMessageCounts(output.value)).toEqual(expectedCounts);
};

const stopChildProcess = async (child: ChildProcessWithoutNullStreams) => {
  if (child.exitCode !== null || child.pid == null) return;

  await new Promise<void>((resolve, reject) => {
    treeKill(child.pid ?? 0, error => {
      if (error) reject(error);
      else resolve();
    });
  });

  await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), sleep(5000)]);
};

const startFunctionApp = (project: string) => {
  const output = { value: '' };
  const child = spawn(`${NPM_EXECUTABLE} exec nx run ${project}:start`, {
    cwd: tmpProjPath(),
    env: getStartProcessEnv(),
    shell: true,
  });

  child.stdout.on('data', data => {
    output.value += stripAnsi(data.toString());
  });

  child.stderr.on('data', data => {
    output.value += stripAnsi(data.toString());
  });

  return { child, output };
};

const updateProjectTsConfig = (directory: string, mutateTsConfig: TsConfigMutator) => {
  const tsconfigPath = `${directory}/tsconfig.json`;
  const tsconfig = readJson<Record<string, unknown>>(tsconfigPath) as {
    compilerOptions?: Record<string, unknown>;
  };

  mutateTsConfig(tsconfig);
  updateFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
};

const removeWorkspaceDevDependency = (dependencyName: string) => {
  const workspacePackageJson = readJson<Record<string, unknown>>('package.json') as {
    devDependencies?: Record<string, string>;
  };

  delete workspacePackageJson.devDependencies?.[dependencyName];
  updateFile('package.json', JSON.stringify(workspacePackageJson, null, 2));
};

const updateProjectPackageJson = (directory: string, mutatePackageJson: (packageJson: Record<string, unknown>) => void) => {
  const packageJsonPath = `${directory}/package.json`;
  const packageJson = readJson<Record<string, unknown>>(packageJsonPath);

  mutatePackageJson(packageJson);
  updateFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
};

const prepareProjectForStart = ({ directory, funcFilePath }: PreparedProject, moduleKind: unknown) => {
  updateFile(
    funcFilePath,
    `
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return { body: 'watch stable' };
};

app.http('hello', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: hello
});
  `,
  );

  if (moduleKind !== 'commonjs') return;

  updateProjectPackageJson(directory, packageJson => {
    packageJson.type = 'commonjs';
  });
};

const addConsoleLogToHandler = (funcFilePath: string) => {
  updateFile(funcFilePath, content => {
    const handlerSignature = 'export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {\n';
    if (!content.includes(handlerSignature)) throw new Error(`Could not find hello handler in ${funcFilePath}.`);

    return content.replace(handlerSignature, `${handlerSignature}  console.log('watch stability probe');\n`);
  });
};

const assertStartExecutorWatchStability = async (preparedProject: PreparedProject, moduleKind: unknown) => {
  prepareProjectForStart(preparedProject, moduleKind);

  const { funcFilePath, project } = preparedProject;
  const { child, output } = startFunctionApp(project);

  try {
    await waitForOutput(
      child,
      output,
      data => data.includes(FUNC_RUNTIME_READY_MESSAGE) && data.includes(WATCH_READY_MESSAGE) && data.includes(WORKER_READY_MESSAGE),
      'the function app to finish startup',
      WATCH_READY_TIMEOUT,
    );

    const initialCounts = getStartMessageCounts(output.value);
    await assertWatchMessagesAreStable(child, output, initialCounts, 'initial watch stability');

    addConsoleLogToHandler(funcFilePath);

    await waitForOutput(
      child,
      output,
      data => {
        const counts = getStartMessageCounts(data);
        if (
          counts.ready < initialCounts.ready + 1 ||
          counts.rebuild < initialCounts.rebuild + 1 ||
          counts.worker < initialCounts.worker + 1
        )
          return false;

        const rebuildIndex = getOccurrenceIndex(data, WATCH_REBUILD_MESSAGE, initialCounts.rebuild + 1);
        const readyIndex = getOccurrenceIndex(data, WATCH_READY_MESSAGE, initialCounts.ready + 1);
        const workerIndex = getOccurrenceIndex(data, WORKER_READY_MESSAGE, initialCounts.worker + 1);

        return rebuildIndex !== -1 && readyIndex > rebuildIndex && workerIndex > readyIndex;
      },
      'a single rebuild and worker restart after changing the function handler',
      WATCH_REBUILD_TIMEOUT,
    );

    const rebuiltCounts = getStartMessageCounts(output.value);
    expect(rebuiltCounts.ready).toBe(initialCounts.ready + 1);
    expect(rebuiltCounts.rebuild).toBe(initialCounts.rebuild + 1);
    expect(rebuiltCounts.worker).toBe(initialCounts.worker + 1);

    await assertWatchMessagesAreStable(child, output, rebuiltCounts, 'post-rebuild watch stability');
  } finally {
    await stopChildProcess(child);
  }
};

const checkTheThing = async (project: string, directory: string, mutateTsConfig?: TsConfigMutator): Promise<PreparedProject> => {
  const func = 'hello';

  await runNxCommandAsync(`g @nxazure/func:init ${project} --directory=${directory}`);
  await runNxCommandAsync(`g @nxazure/func:new ${func} --project=${project} --template="HTTP trigger"`);
  removeWorkspaceDevDependency('azure-functions-core-tools');
  await runCommandAsync('npm i');
  if (mutateTsConfig) updateProjectTsConfig(directory, mutateTsConfig);

  const funcFilePath = `${directory}/src/functions/${func}.ts`;

  updateFile(
    funcFilePath,
    `
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ${lib1} } from "@proj/${lib1}";

export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const name = request.query.get('name') || await request.text() || 'world';

  return { body: ${lib1}() };
};

app.http('hello', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: hello
});
  `,
  );

  const projectJsonPath = `${directory}/project.json`;
  const projectConfig = readJson<Record<string, unknown>>(projectJsonPath) as {
    targets: { build: { options?: Record<string, unknown> } };
  };

  projectConfig.targets.build.options ??= {};
  projectConfig.targets.build.options.assets = [
    `README.md`,
    `${directory}/prompts/**/*.md`,
    {
      input: `${directory}/static`,
      glob: '**/*.json',
      output: 'static-assets',
    },
    {
      input: `${directory}/scoped-static`,
      glob: '**/*.json',
      output: `${directory}/static-assets`,
    },
  ];

  updateFile(projectJsonPath, JSON.stringify(projectConfig, null, 2));

  const projectRoot = tmpProjPath(directory);

  fs.mkdirSync(path.join(projectRoot, 'prompts', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'static', 'configs'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'scoped-static', 'configs'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'prompts', 'welcome.md'), 'prompt root');
  fs.writeFileSync(path.join(projectRoot, 'prompts', 'nested', 'follow-up.md'), 'prompt nested');
  fs.writeFileSync(path.join(projectRoot, 'static', 'app.json'), '{"name":"func"}');
  fs.writeFileSync(path.join(projectRoot, 'static', 'configs', 'env.json'), '{"env":"test"}');
  fs.writeFileSync(path.join(projectRoot, 'scoped-static', 'app.json'), '{"name":"func-scoped"}');
  fs.writeFileSync(path.join(projectRoot, 'scoped-static', 'configs', 'env.json'), '{"env":"scoped-test"}');

  console.log('Running build...');
  try {
    const buildResult = await runNxCommandAsync(`build ${project}`);
    if (buildResult.stderr) console.error('Error: ', buildResult.stderr);

    expect(buildResult.stdout).toContain(`<⚡> ["${project}"] Build is ready.`);
    expect(fs.existsSync(path.join(projectRoot, 'dist', 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'prompts', 'welcome.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'prompts', 'nested', 'follow-up.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', 'static-assets', 'app.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', 'static-assets', 'configs', 'env.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'static-assets', 'app.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'dist', directory, 'static-assets', 'configs', 'env.json'))).toBe(true);
  } catch (e) {
    console.error('Build failed with error: ', e);
    throw e;
  }

  return { directory, funcFilePath, project };
};

describe('Project initialization and build', () => {
  // Setting up individual workspaces per
  // test can cause e2e runs to take a long time.
  // For this reason, we recommend each suite only
  // consumes 1 workspace. The tests should each operate
  // on a unique project in the workspace, such that they
  // are not dependant on one another.
  beforeAll(async () => {
    await setupWorkspace();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // `nx reset` kills the daemon, and performs
    // some work which can help clean up e2e leftovers
    await resetWorkspace();
  }, TEST_TIMEOUT);

  it(
    'should init & build a workspace with a js lib and, a functions app and a function that uses that lib',
    async () => {
      const project = uniq('func');
      const directory = `apps/${project}`;

      console.log('Checking test 1');
      await checkTheThing(project, directory);
    },
    TEST_TIMEOUT,
  );

  it(
    'should init & build a workspace with a js lib, a nested functions app (apps/test/my-app) and a function that uses that lib',
    async () => {
      const project = `${uniq('func')}`;
      const directory = `apps/sub-app/${project}`;

      console.log('Checking test 2');
      await checkTheThing(project, directory);
    },
    TEST_TIMEOUT,
  );

  it(
    'should show a readable error when assets are configured and @nx/js is missing',
    async () => {
      const project = uniq('func');
      const directory = `apps/${project}`;
      const projectRoot = tmpProjPath(directory);

      await runNxCommandAsync(`g @nxazure/func:init ${project} --directory=${directory}`);

      const projectJsonPath = `${directory}/project.json`;
      const projectConfig = readJson<Record<string, unknown>>(projectJsonPath) as {
        targets: { build: { options?: Record<string, unknown> } };
      };

      projectConfig.targets.build.options ??= {};
      projectConfig.targets.build.options.assets = [`${directory}/README.md`];
      updateFile(projectJsonPath, JSON.stringify(projectConfig, null, 2));
      fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Missing peer');

      const nxJsPath = tmpProjPath(path.join('node_modules', '@nx', 'js'));
      const nxJsBackupPath = tmpProjPath(path.join('node_modules', '@nx', 'js.bak'));
      const repoNxJsPath = path.join(process.cwd(), 'node_modules', '@nx', 'js');
      const repoNxJsBackupPath = path.join(process.cwd(), 'node_modules', '@nx', 'js.bak');

      fs.renameSync(nxJsPath, nxJsBackupPath);
      fs.renameSync(repoNxJsPath, repoNxJsBackupPath);

      try {
        const buildResult = await runNxCommandAsync(`build ${project}`, { silenceError: true });
        const output = `${buildResult.stdout}\n${buildResult.stderr}`;
        expect(output).toContain('Asset copying for @nxazure/func requires the optional peer dependency "@nx/js"');
        expect(output).toContain('npm install -D @nx/js');
      } finally {
        fs.renameSync(nxJsBackupPath, nxJsPath);
        fs.renameSync(repoNxJsBackupPath, repoNxJsPath);
      }
    },
    TEST_TIMEOUT,
  );

  it.each(tsConfigScenarios)(
    'should build a functions app with $name and keep watch stable',
    async ({ compilerOptions }) => {
      const project = uniq('func');
      const directory = `apps/${project}`;

      const preparedProject = await checkTheThing(project, directory, tsconfig => {
        tsconfig.compilerOptions ??= {};
        Object.assign(tsconfig.compilerOptions, compilerOptions);
      });

      await assertStartExecutorWatchStability(preparedProject, compilerOptions.module);
    },
    TEST_TIMEOUT,
  );
});
