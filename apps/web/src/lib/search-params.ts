import { parseSearchWith, stringifySearchWith } from "@tanstack/react-router";

function toBase64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): unknown {
  let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = base64.length % 4;
  if (remainder === 2) {
    base64 += "==";
  } else if (remainder === 3) {
    base64 += "=";
  } else if (remainder === 1) {
    throw new Error("invalid base64url length");
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const parseSearch = parseSearchWith(fromBase64Url);
export const stringifySearch = stringifySearchWith(toBase64Url);
