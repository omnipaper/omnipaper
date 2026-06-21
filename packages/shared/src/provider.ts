// Provider API keys, shared by the OCR runner (mistral/google) and the AI metadata classifier
// (openai/anthropic/mistral/google). One bag of optional keys; each consumer reads only the
// providers it supports. Stored encrypted in instance settings (provider-settings.ts).
export type ProviderKeys = {
  mistral?: string;
  google?: string;
  openai?: string;
  anthropic?: string;
};
