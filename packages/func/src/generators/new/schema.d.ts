export interface NewGeneratorSchema {
  project: string;
  name: string;
  language: 'TypeScript';
  template: string;
  authLevel?: 'anonymous' | 'function' | 'admin';
}
