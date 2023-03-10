import { getWorkspaceLayout, names, readJson, Tree } from '@nrwl/devkit';
import path from 'path';
import { CompilerOptions } from 'typescript';
import { IMPORT_REGISTRATION, TS_CONFIG_BUILD_FILE } from '../../common';
import { NewGeneratorSchema } from './schema';
import templates from './templates.json';

type Binding = {
  name: string;
  type: string;
  direction: string;
} & Record<string, unknown>;

type Template = {
  id: string;
  runtime: string;
  files: Record<string, string>;
  function: {
    disabled?: boolean;
    bindings: Binding[];
  };
  metadata: {
    name: string;
    language: string;
  };
};

type NormalizedOptions = Pick<NewGeneratorSchema, 'language' | 'authLevel'> & {
  funcRoot: string;
  funcNames: ReturnType<typeof names>;
  template: Template;
};

const normalizeOptions = (tree: Tree, { name, project, template, language, ...rest }: NewGeneratorSchema): NormalizedOptions => {
  const funcNames = names(name);
  const projectNames = names(project);

  const { appsDir } = getWorkspaceLayout(tree);
  const projectRoot = path.join(appsDir, names(project).fileName);
  if (!tree.exists(projectRoot)) throw new Error(`Project [${project} (${projectNames.fileName})] does not exist in the workspace.`);

  const funcRoot = path.join(projectRoot, funcNames.fileName);
  if (tree.exists(funcRoot))
    console.log(
      `\x1B[33mFunction [${name}] already exists in [${project}]`,
      '\x1B[90m',
      `I sure hope you know what you're doing. 🤞`,
      '\x1B[0m',
    );

  const selectedTemplate = templates.find(t => t.metadata.language === language && t.metadata.name === template);
  if (!selectedTemplate) throw new Error(`Template '${template}' for language '${language}' was not found`);

  return {
    funcRoot,
    funcNames,
    template: selectedTemplate,
    language,
    ...rest,
  };
};

const createFunctionJson = (tree: Tree, { funcRoot, template, authLevel }: NormalizedOptions) => {
  const functionJsonObject = { ...template.function };
  if (template.metadata.language === 'TypeScript') {
    const {
      compilerOptions: { outDir },
    } = readJson<{ compilerOptions: CompilerOptions }>(tree, path.join(funcRoot, '..', TS_CONFIG_BUILD_FILE));

    const indexJsRelativePath = path.posix.join('..', outDir, funcRoot, 'index.js');
    const posixIndexJsRelativePath = path.posix.join(...indexJsRelativePath.split(path.sep));

    if (template.metadata.language === 'TypeScript') {
      // For TypeScript functions, a scriptFile should be added to the function.json
      functionJsonObject['scriptFile'] = posixIndexJsRelativePath;
    }
  }

  // Change auth level in httpTrigger bindings
  functionJsonObject.bindings.filter(b => b.type === 'httpTrigger').forEach(b => (b['authLevel'] = authLevel ?? 'anonymous'));

  tree.write(path.join(funcRoot, 'function.json'), JSON.stringify(functionJsonObject, null, 2));
};

const createTemplateFiles = (tree: Tree, { funcRoot, template }: NormalizedOptions) => {
  Object.entries(template.files)
    .filter(([name]) => !name.endsWith('.dat'))
    .forEach(([name, content]) => {
      if (name === 'index.ts') content = `${IMPORT_REGISTRATION}\n${content}`;
      tree.write(path.join(funcRoot, name), content);
    });
};

export default async function (tree: Tree, options: NewGeneratorSchema) {
  const originalConsoleLog = console.log;

  try {
    if (options.silent)
      console.log = () => {
        // Empty on purpose to silent all output
      };

    const normalizedOptions = normalizeOptions(tree, options);

    createFunctionJson(tree, normalizedOptions);
    createTemplateFiles(tree, normalizedOptions);
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    console.log = originalConsoleLog;
  }
}
