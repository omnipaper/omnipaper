import { ac, roles } from "@omnipaper/permissions";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [adminClient(), organizationClient({ ac, roles })],
});

export const { signIn, signUp, signOut, useSession } = authClient;
