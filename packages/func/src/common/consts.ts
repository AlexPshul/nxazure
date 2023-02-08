export const TS_CONFIG_WORKSPACE_FILE = 'tsconfig.json';
export const TS_CONFIG_BUILD_FILE = 'tsconfig.build.json';
export const TS_CONFIG_BASE_FILE = 'tsconfig.base.json';

const registrationFileName = '_registerPaths';
export const REGISTRATION_FILE = `${registrationFileName}.ts`;
export const IMPORT_REGISTRATION = `import '../${registrationFileName}'; // Import before any other lib imports`;

export const GLOBAL_NAME = '@nxazure';
export const FUNC_PACKAGE_NAME = 'func';
