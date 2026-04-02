import fs from 'fs';
import path from 'path';

type LockfileSnapshot = {
  contents: Buffer | null;
  exists: boolean;
  path: string;
};

const LOCKFILE_NAMES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];

export const getLockfileSnapshots = (projectRoot: string): LockfileSnapshot[] =>
  LOCKFILE_NAMES.map(lockfileName => {
    const lockfilePath = path.join(projectRoot, lockfileName);
    const exists = fs.existsSync(lockfilePath);

    return {
      contents: exists ? fs.readFileSync(lockfilePath) : null,
      exists,
      path: lockfilePath,
    };
  });

export const restoreLockfiles = (lockfileSnapshots: LockfileSnapshot[]) => {
  lockfileSnapshots.forEach(({ contents, exists, path: lockfilePath }) => {
    if (exists && contents) {
      fs.writeFileSync(lockfilePath, contents);
      return;
    }

    fs.rmSync(lockfilePath, { force: true });
  });
};
