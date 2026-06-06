import type { auth } from "./auth";

export type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  organizationId: string;
  // The caller's role within organizationId, loaded once by requireOrganization and reused by
  // requireOrgPermission — so capability checks cost no extra DB query.
  memberRole: string;
};
