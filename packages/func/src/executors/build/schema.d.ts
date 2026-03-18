export type AssetGlobPattern = {
  glob: string;
  input: string;
  ignore?: string[];
  output: string;
};

export interface BuildExecutorSchema {
  assets?: (string | AssetGlobPattern)[];
  includeIgnoredAssetFiles?: boolean;
}
