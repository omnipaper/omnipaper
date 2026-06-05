import { customAlphabet } from "nanoid";

const generateId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  21,
);

export function createId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}
