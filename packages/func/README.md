<h1 align="center">Azure Functions NX Plugin</h1>
<p align="center">
  <img src="https://raw.githubusercontent.com/AlexPshul/nxazure/master/packages/func/TitleLogo.png" />
</p>
<h3 align="center">
  Develop a full serverless Azure Functions solution in NX monorepo
</h3>
<p align="center">
This plugin allows you to initialize, create, build, run and publish Azure Functions inside your NX workspace.
</p>
<hr>

## Versioning

For **NX <= 19**, use @nxazure/func version **1.2.0** and lower
For **NX >= 20**, use @nxazure/func version **1.2.1** and higher

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Migrating to v2](#migrating-to-v2)
4. [Known possible issues](#known-possible-issues)
5. [Publish to Azure](#publish-to-azure)
6. [Limitations](#limitations)

## Quick Start

1. Make sure your environment is set as described in the [Azure Functions docs](https://learn.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-typescript#configure-your-environment).
2. Make sure you install the latest [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=windows%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-typescript#install-the-azure-functions-core-tools). The minimum required version is **4.0.5390**. You can check your currently installed version by running `func --version` command.
3. Create an [NX workspace](https://nx.dev/getting-started/intro) with any method.

```bash
npx create-nx-workspace@latest my-org
```

3. Add the @nxazure/func package

```bash
npm install -D @nxazure/func
```

4. Initialize a function app

```bash
nx g @nxazure/func:init my-new-app --directory=apps/my-new-app
```

5. Add a function to the app

```bash
nx g @nxazure/func:new myNewFunc --project=my-new-app --template="HTTP trigger"
```

6. Run the function app

```bash
nx start my-new-app
```

<br/>

## Features

1. Support for TS Config paths (e.g., `import { tool } from '@my-org/my-lib'`)
2. Support for a single `node_modules` folder in the root dir (just like in other monorepo solutions)
3. Environment variables are loaded by NX (from .env files) but they can be overwritten by individual local.settings.json files
4. All current templates that are supported by the `func` CLI tool are supported.
5. Run multiple functions at once `nx run-many --target=start --all`
6. Publish the function app straight to your Azure account (az login is required)

<br/>

## Assets

The build executor supports the standard Nx-style `assets` option on the app's `build` target.
If you use this feature, install the optional peer dependency first:

```bash
npm install -D @nx/js
```

Example direct copy:

```json
{
  "targets": {
    "build": {
      "executor": "@nxazure/func:build",
      "options": {
        "assets": ["apps/my-func/README.md"]
      }
    }
  }
}
```

Example wildcard copy:

```json
{
  "targets": {
    "build": {
      "executor": "@nxazure/func:build",
      "options": {
        "assets": ["apps/my-func/prompts/**/*.md"]
      }
    }
  }
}
```

Example object-form asset pattern:

```json
{
  "targets": {
    "build": {
      "executor": "@nxazure/func:build",
      "options": {
        "assets": [
          {
            "input": "apps/my-func/static",
            "glob": "**/*.json",
            "output": "static"
          }
        ]
      }
    }
  }
}
```

<br/>

## Migrating to v2

The recommended way to migrate is to let Nx run the migrations automatically:

```bash
nx migrate @nxazure/func@latest
nx migrate --run-migrations
```

This will apply all the necessary changes to your workspace. If you prefer to migrate manually (or if the automatic migration didn't run), follow the steps below for **each** function app project in your workspace.

### 1. Merge `tsconfig.build.json` into `tsconfig.json`

The build executor no longer reads `tsconfig.build.json`. All TypeScript configuration must live in `tsconfig.json`.

1. Open `tsconfig.build.json` in your function app.
2. Copy every `compilerOptions` entry into `tsconfig.json`. If the same key exists in both files, use the value from `tsconfig.build.json` (it was what the build was actually using). Skip `noEmitOnError`, `rootDir`, and `tsBuildInfoFile` — the build executor manages those automatically.
3. Copy any top-level fields like `include`, `exclude`, or `files` into `tsconfig.json`. Again, if a conflict exists, prefer the `tsconfig.build.json` value.
4. Make sure `compilerOptions.outDir` is set (e.g., `"dist"`).
5. Delete `tsconfig.build.json`.

### 2. Remove `_registerPaths.ts` and `tsconfig-paths`

Runtime path registration has been replaced by a compile-time transformer. The plugin now rewrites import paths during the build, so `_registerPaths.ts` is no longer needed.

1. Delete `_registerPaths.ts` from your function app root.
2. If your `.eslintrc.json` references `_registerPaths.ts` in `ignorePatterns`, remove that entry.
3. Remove `tsconfig-paths` from your workspace root `package.json` dependencies (if present).

### 3. Clean up the app-level `package.json`

The publish executor now automatically discovers runtime dependencies from your source code and injects them at publish time. You no longer need to list them in the app's `package.json`.

1. Open the `package.json` in your function app.
2. Remove any dependency that is directly imported in your source code (e.g., `@azure/functions`). The publish executor will handle these automatically.
3. Keep any dependency that is **not** imported from your code — these are peer or indirect dependencies that you manage yourself.
4. Add `"type": "module"` to the `package.json`.

### Example

Before:
```json
{
  "name": "my-func-app",
  "dependencies": {
    "@azure/functions": "^4.0.0",
    "some-manual-peer-dep": "^1.0.0"
  }
}
```

After (assuming `@azure/functions` is imported in your code and `some-manual-peer-dep` is not):
```json
{
  "name": "my-func-app",
  "type": "module",
  "dependencies": {
    "some-manual-peer-dep": "^1.0.0"
  }
}
```

<br/>

## Known possible issues

1. If after creation the build is failing, try updating `@types/node` and/or `typescript` versions.
2. To be able to publish a function to your Azure account, an [az login](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli) is required first.
3. If you are using the [flat eslint config](https://nx.dev/recipes/tips-n-tricks/flat-config), you might want to add the following to the end of your base config export:

```js
  {
    ignores: ['apps/**/dist'],
  }
```

<br/>

## Publish to Azure

1. Sign in to Azure

```bash
az login
```

2. Make sure you select the correct subscription

```bash
az account set --subscription "<subscription ID or name>"
```

You can learn more about it on [Microsoft Learn](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli).

3. Use the name of your local NX app and the name of your existing function app on Azure to run the publish command:

```bash
nx publish <local-app-name> -n <function-app-on-azure>
```

4. Wait for the process to finish and the triggers to properly sync

<br/>

## Limitations

Currently, the plugin supports only TypeScript functions.
