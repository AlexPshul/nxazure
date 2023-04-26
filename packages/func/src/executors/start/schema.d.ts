export interface StartExecutorSchema {
  port: number;
  cors: string;
  corsCredentials: boolean;
  timeout: number;
  useHttps: boolean;
  cert: string;
  password: string;
  languageWorker: string;
  noBuild: boolean;
  enableAuth: boolean;
  functions: string;
  verbose: boolean;
  dotnetIsolatedDebug: boolean;
  enableJsonOutput: boolean;
  jsonOutputFile: string;
} // eslint-disable-line
