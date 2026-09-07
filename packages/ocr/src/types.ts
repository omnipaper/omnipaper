export type { ProviderKeys } from "@omnipaper/shared/provider";

export type DocumentInput = {
  data: Uint8Array;
  mimeType: string;
};

export type ExtractTextResult = {
  text: string;
};
