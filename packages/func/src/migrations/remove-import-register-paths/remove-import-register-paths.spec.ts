import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './remove-import-register-paths';

const file1Content = `import './register-paths';
const foo = 'bar';
console.log(foo);`;

const file2Content = `import './subfolder/register-paths';
function hello() {
  console.log('Hello, world!');
}
hello();`;

const file3Content = `import '../_registerPaths.ts';
const x = 42;
console.log(x);`;

const file3FixedContent = `const x = 42;
console.log(x);`;

const file4Content = `import '../subfolder/_registerPaths.ts';
const y = 3.14;
console.log(y);`;

const file4FixedContent = `const y = 3.14;
console.log(y);`;

const file5Content = `import '../subfolder/_registerPaths.ts' // A comment that also should be removed;
const y = 3.14;
console.log(y);`;

const file5FixedContent = `const y = 3.14;
console.log(y);`;

describe('remove-import-register-paths migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('/apps/file1.ts', file1Content);
    tree.write('/apps/file2.ts', file2Content);
    tree.write('/apps/subfolder/file3.ts', file3Content);
    tree.write('/apps/subfolder/file4.ts', file4Content);
    tree.write('/apps/subfolder/file5.ts', file5Content);

    update(tree);
  });

  it('should NOT remove import statements from file1.ts', async () => {
    expect(tree.read('/apps/file1.ts').toString()).toBe(file1Content);
  });

  it('should NOT remove import statements from file2.ts', async () => {
    expect(tree.read('/apps/file2.ts').toString()).toBe(file2Content);
  });

  it('should remove import statements from file3.ts', async () => {
    expect(tree.read('/apps/subfolder/file3.ts').toString()).toBe(file3FixedContent);
  });

  it('should remove import statements from file4.ts', async () => {
    expect(tree.read('/apps/subfolder/file4.ts').toString()).toBe(file4FixedContent);
  });

  it('should remove import statement WITH the comment file5.ts', async () => {
    expect(tree.read('/apps/subfolder/file5.ts').toString()).toBe(file5FixedContent);
  });
});
