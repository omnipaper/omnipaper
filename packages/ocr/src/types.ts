export type DocumentInput = {
  documentUrl: string;
  mimeType: string;
};

export type ExtractTextResult = {
  text: string;
};

export type ProviderKeys = {
  mistral?: string;
  google?: string;
};
