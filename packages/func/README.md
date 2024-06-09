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

## Table of Contents
1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Known possible issues](#known-possible-issues)
4. [Publish to Azure](#publish-to-azure)
5. [Limitations](#limitations)

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
nx g @nxazure/func:init my-new-app
```

5. Add a function to the app

```bash
nx g @nxazure/func:new my-new-func --project=my-new-app --template="HTTP trigger"
```

6. Run the function app

```bash
nx start my-new-app
```

<br/>

## Features

1. Support for TS Config paths (e.g., `import { tool } from '@my-org/my-lib'`)
2. Support for a single `node_modules` folder in the root dir (just like in other monorepo solutions)
3. All current templates that are supported by the `func` CLI tool are supported.
4. Run multiple functions at once `nx run-many --target=start --all`
5. Publish the function app straight to your Azure account (az login is required)

<br/>

## Known possible issues

1. If after creation the build is failing, try updating `@types/node` and/or `typescript` versions.
2. To be able to publish a function to your Azure account, an [az login](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli) is required first.

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
