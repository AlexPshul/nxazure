
<h1 align="center">Azure Functions NX Plugin</h1>
<p align="center">
  <a href="https://nx.dev">
    <img src="https://cdn-images-1.medium.com/max/1200/1*WKgsSIGP_n6acei-mDWsOA.png" style="height:150px;" />
  </a>
  <a href="https://azure.microsoft.com/en-us/products/functions/">
    <img src="https://pbs.twimg.com/profile_images/1196482103841452032/p_RFRssy_400x400.png" style="height:150px;" />
  </a>
</p>
<h3 align="center">
  Develop a full serverless Azure Functions solution in NX monorepo
</h3>
<p align="center">
This plugin allows you to initialize, create, build, run and publish Azure Functions inside your NX workspace.
</p>
<hr>


## Quick Start
1. Make sure your environment is set as described in the [Azure Functions docs](https://learn.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-typescript#configure-your-environment).
2. Create an [NX workspace](https://nx.dev/getting-started/intro) with any method.  
```bash
npx create-nx-workspace@latest my-org
```
3. Add the @nx-azure/func package
```bash
npm install -D @nx-azure/func
```
4. Initialize a function app
```bash
nx g @nx-azure/func:init my-new-app
```
5. Add a function to the app
```bash
nx g @nx-azure/func:new my-new-func --project=my-new-app --template="HTTP trigger"
```
6. Run the function app
```bash
nx start my-new-func
```

<br/>

## Known possible issues
1. If after creation the build is failing, try updating @types/node and/or typescript versions.
2. To be able to publish a function to your Azure account, an [az login](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli) is required first.

<br/>

## Features
1. Support for TS Config paths (e.g., `import { tool } from '@my-org/my-lib'`)
2. Support for a single `node_modules` folder in the root dir (just like in other monorepo solutions)
3. All current templates that are supported by the `func` CLI tool are supported.
4. Run multiple functions at once `nx run-many --target=start --all`


<br/>

## Limitations
Currently, the plugin supports only TypeScript functions.  
