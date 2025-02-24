import { execSync, ExecSyncOptions } from 'child_process';

export const execWithRetry = (name: string, command: string, options: ExecSyncOptions, maxRetries = 3) => {
  let attempts = 0;

  do {
    try {
      attempts++;
      console.log(`- ${name}. Attempt [${attempts}/${maxRetries}]`);
      execSync(command, options);
      return;
    } catch (error) {
      console.error(`Error executing command: ${name}. Attempt ${attempts} failed.`);
      if (attempts === maxRetries) {
        throw error;
      }
    }
  } while (attempts < maxRetries);
};
