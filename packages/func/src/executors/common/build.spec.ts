import { ExecutorContext } from '@nx/devkit';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { build } from './build';

const createWorkspace = () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nxazure-func-build-'));
  const appRoot = path.join('apps', 'demo-app');
  const appRootPath = path.join(workspaceRoot, appRoot);

  fs.mkdirSync(path.join(appRootPath, 'src', 'functions'), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'workspace', version: '1.0.0' }, null, 2));
  fs.writeFileSync(
    path.join(workspaceRoot, 'tsconfig.base.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'esnext',
          moduleResolution: 'node',
          target: 'es2015',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(appRootPath, 'package.json'), JSON.stringify({ name: 'demo-app', version: '1.0.0' }, null, 2));
  fs.writeFileSync(
    path.join(appRootPath, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: 'dist',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(appRootPath, 'src', 'functions', 'hello.ts'), 'export const hello = () => "hello";\n');

  return { appRoot, appRootPath, workspaceRoot };
};

describe('build executor', () => {
  const originalCwd = process.cwd();
  const tempDirs: string[] = [];

  afterEach(() => {
    process.chdir(originalCwd);
    tempDirs.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it('does not mutate the app package.json during build', async () => {
    const { appRoot, appRootPath, workspaceRoot } = createWorkspace();
    tempDirs.push(workspaceRoot);
    process.chdir(workspaceRoot);

    const appPackageJsonPath = path.join(appRootPath, 'package.json');
    const originalPackageJson = fs.readFileSync(appPackageJsonPath, 'utf-8');
    const context = {
      cwd: workspaceRoot,
      projectName: 'demo-app',
      projectsConfigurations: {
        projects: {
          'demo-app': {
            root: appRoot,
            targets: {
              build: {
                options: {},
              },
            },
          },
        },
      },
      root: workspaceRoot,
    } as unknown as ExecutorContext;

    await expect(build(context)).resolves.toBe(true);

    expect(fs.readFileSync(appPackageJsonPath, 'utf-8')).toBe(originalPackageJson);
    expect(fs.existsSync(path.join(appRootPath, 'dist'))).toBe(true);
  });
});
