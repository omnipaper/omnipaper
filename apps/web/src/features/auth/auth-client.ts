import { ac, roles } from "@omnipaper/permissions";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/lib/env-client";

const API_URL = env.VITE_API_URL ?? window.location.origin;

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [adminClient(), organizationClient({ ac, roles })],
});

export const { signIn, signUp, signOut, useSession } = authClient;
