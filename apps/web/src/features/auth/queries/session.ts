import { authClient } from "@/features/auth/auth-client";
import { queryOptions } from "@tanstack/react-query";

// Query-key factory + read for the session domain. Session is a singleton (the current user's
// session), so the key factory has a single `all` entry — every consumer that invalidates or
// removes the session cache references it instead of hand-rolling ["session"].
export const sessionKeys = {
  all: ["session"] as const,
};

export const sessionQueryOptions = queryOptions({
  queryKey: sessionKeys.all,
  queryFn: async () => {
    const { data } = await authClient.getSession();
    return data;
  },
  staleTime: 15 * 60 * 1000,
});
