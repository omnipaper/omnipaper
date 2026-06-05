export type OcrResult = {
  text: string;
};

export type OcrAdapter = {
  name: string;
  extract: (args: { documentUrl: string; mimeType: string }) => Promise<OcrResult>;
  testConnection: () => Promise<void>;
};
