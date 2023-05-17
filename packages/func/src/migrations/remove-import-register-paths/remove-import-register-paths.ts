import { Tree } from '@nx/devkit';
import path from 'path';

const handleFolderFiles = (host: Tree, folder: string) => {
  const children = host.children(folder).map(child => path.join(folder, child));

  const files = children.filter(child => host.isFile(child));
  const folders = children.filter(child => !host.isFile(child));

  files.forEach(file => {
    const fileContent = host.read(file).toString();
    const alteredContent = fileContent.replace(/import.*_registerPaths\.ts.*\n/gm, '');

    host.write(file, alteredContent);
  });

  folders.forEach(folder => handleFolderFiles(host, folder));
};

const update = (host: Tree) => handleFolderFiles(host, '/');
export default update;
