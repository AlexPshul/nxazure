import { getWorkspaceLayout, names, Tree } from '@nx/devkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { copyToTempFolder } from '../common';
import { TemplateValues } from './consts';
import { NewGeneratorSchema } from './schema';

const FUNCTIONS_FOLDER = 'src/functions';

type Template = (typeof TemplateValues)[number];

type NormalizedOptions = Pick<NewGeneratorSchema, 'language' | 'authLevel' | 'silent' | 'template'> & {
  projectRoot: string;
  funcNames: ReturnType<typeof names>;
  template: Template;
};

const isTemplateValid = (template: string): template is Template => TemplateValues.includes(template as Template);

const normalizeOptions = (tree: Tree, { name, project, template, language, authLevel, silent }: NewGeneratorSchema): NormalizedOptions => {
  const funcNames = names(name);
  const projectNames = names(project);

  const { appsDir } = getWorkspaceLayout(tree);
  const projectRoot = path.join(appsDir, names(project).fileName);
  if (!tree.exists(projectRoot)) throw new Error(`Project [${project} (${projectNames.fileName})] does not exist in the workspace.`);

  if (!isTemplateValid(template)) throw new Error(`Template [${template}] is not supported.`);

  return {
    projectRoot,
    funcNames,
    template: template as NormalizedOptions['template'],
    language,
    authLevel: template === 'HTTP trigger' ? authLevel : undefined,
    silent,
  };
};

const copyFiles = (tree: Tree, copyFromRootPath: string, copyToRootPath: string, subFolder: string) => {
  const sourceFolder = path.posix.join(copyFromRootPath, subFolder);
  const destinationFolder = path.posix.join(copyToRootPath, subFolder);

  const files = fs.readdirSync(sourceFolder);
  if (files.length === 0) throw new Error('No files were found to copy');

  files
    .map(file => ({ destination: path.join(destinationFolder, file), content: fs.readFileSync(path.join(sourceFolder, file)).toString() }))
    .forEach(({ destination, content }) => tree.write(destination, content));
};

export default async function (tree: Tree, options: NewGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);

  const originalConsoleLog = console.log;
  if (options.silent) console.log = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

  const tempFolder = copyToTempFolder(tree, normalizedOptions.projectRoot);

  try {
    let funcNewCommand = `func new -n ${normalizedOptions.funcNames.fileName} -t "${normalizedOptions.template}"`;
    if (normalizedOptions.authLevel) funcNewCommand += ` -a ${normalizedOptions.authLevel}`;

    execSync(funcNewCommand, { cwd: tempFolder, stdio: 'ignore' });

    copyFiles(tree, tempFolder, normalizedOptions.projectRoot, FUNCTIONS_FOLDER);
  } catch (e) {
    console.error(`Could not create ${normalizedOptions.funcNames.fileName} function with template ${normalizedOptions.template}.`, e);
    throw e;
  } finally {
    console.log = originalConsoleLog;
    fs.rmSync(tempFolder, { recursive: true });
  }
}
