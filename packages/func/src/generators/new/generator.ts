import { getWorkspaceLayout, names, readJson, Tree } from '@nrwl/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { IMPORT_REGISTRATION } from '../../common';
import { copyToTempFolder } from '../common';
import { NewGeneratorSchema } from './schema';

const V4_FUNCTIONS_FOLDER = 'src/functions';

type NormalizedOptions = Pick<NewGeneratorSchema, 'language' | 'authLevel' | 'silent'> & {
  projectRoot: string;
  funcNames: ReturnType<typeof names>;
  v4: boolean;
  template: string;
};

const normalizeOptions = (tree: Tree, { name, project, template, language, authLevel, silent }: NewGeneratorSchema): NormalizedOptions => {
  const funcNames = names(name);
  const projectNames = names(project);

  const { appsDir } = getWorkspaceLayout(tree);
  const projectRoot = path.join(appsDir, names(project).fileName);
  if (!tree.exists(projectRoot)) throw new Error(`Project [${project} (${projectNames.fileName})] does not exist in the workspace.`);

  const settings = readJson<{ Values: { AzureWebJobsFeatureFlags?: string } }>(tree, path.posix.join(projectRoot, 'local.settings.json'));

  return {
    projectRoot,
    funcNames,
    template: template.replace(' (V3 only)', ''),
    language,
    v4: !!settings.Values.AzureWebJobsFeatureFlags,
    authLevel: template === 'HttpTrigger' ? authLevel : undefined,
    silent,
  };
};

const copyFiles = (tree: Tree, copyFromRootPath: string, copyToRootPath: string, subFolder: string) => {
  const sourceFolder = path.posix.join(copyFromRootPath, subFolder);
  const destinationFolder = path.posix.join(copyToRootPath, subFolder);

  const files = fs.readdirSync(sourceFolder);
  if (files.length === 0) throw new Error('No files were found to copy');

  files.forEach(file => {
    let content = fs.readFileSync(path.posix.join(sourceFolder, file)).toString();
    if (file.endsWith('.ts')) content = `${IMPORT_REGISTRATION}\n\n${content}`;

    tree.write(path.posix.join(destinationFolder, file), content);
  });
};

export default async function (tree: Tree, options: NewGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);

  const originalConsoleLog = console.log;
  if (options.silent) console.log = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

  const tempFolder = copyToTempFolder(tree, normalizedOptions.projectRoot, normalizedOptions.v4);

  try {
    let funcNewCommand = `func new -n ${normalizedOptions.funcNames.fileName} -t "${normalizedOptions.template}"`;
    if (normalizedOptions.authLevel) funcNewCommand += ` -a ${normalizedOptions.authLevel}`;

    execSync(funcNewCommand, { cwd: tempFolder, stdio: 'ignore' });

    const subFolder = normalizedOptions.v4 ? V4_FUNCTIONS_FOLDER : normalizedOptions.funcNames.fileName;
    copyFiles(tree, tempFolder, normalizedOptions.projectRoot, subFolder);
  } catch (e) {
    console.error(`Could not create ${normalizedOptions.funcNames.fileName} function with template ${normalizedOptions.template}.`);
    // console.error(e);
    throw e;
  } finally {
    console.log = originalConsoleLog;
    fs.rmSync(tempFolder, { recursive: true });
  }
}
