import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// Authorization lives on TWO independent axes — keep them separate:
//
//   • Org axis      — member.role (owner / admin / member), Better Auth `organization` plugin.
//                     Per-organization, tiered. Documents, tags, properties, org settings.
//   • Instance axis — user.role (admin / user), Better Auth `admin` plugin.
//                     Instance-wide, binary. Gates instance config (storage, OCR) + admin routes.
//
// An org "admin" is NOT an instance admin (different column, different plugin), and vice versa.
//
// Naming convention:
//   • is*          — role identity ("is this principal an owner?"). Transparent role check.
//   • can* / has*  — capability ("is this principal allowed to do X?"). Hides the role→action map.
// Pick by the QUESTION you're asking: identity → is*, action → can*/has*.
//
// All checks are pure and zero-DB, so the API middleware and web UI authorize from the exact same
// source and can never drift.

// ── Org axis: access-control definitions ────────────────────────────────────

export const statement = {
  ...defaultStatements,
  documents: ["read", "create", "update", "delete"],
  tags: ["read", "create", "update", "delete"],
  properties: ["read", "create", "update", "delete"],
  documentTypes: ["read", "create", "update", "delete"],
  storagePaths: ["read", "create", "update", "delete"],
  workflows: ["read", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

// Spread *Ac.statements — required to keep better-auth org powers (members, invitations, etc.).
export const roles = {
  owner: ac.newRole({
    ...ownerAc.statements,
    documents: ["read", "create", "update", "delete"],
    tags: ["read", "create", "update", "delete"],
    properties: ["read", "create", "update", "delete"],
    documentTypes: ["read", "create", "update", "delete"],
    storagePaths: ["read", "create", "update", "delete"],
    workflows: ["read", "create", "update", "delete"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    documents: ["read", "create", "update", "delete"],
    tags: ["read", "create", "update", "delete"],
    properties: ["read", "create", "update", "delete"],
    documentTypes: ["read", "create", "update", "delete"],
    storagePaths: ["read", "create", "update", "delete"],
    workflows: ["read", "create", "update", "delete"],
  }),
  member: ac.newRole({
    ...memberAc.statements,
    documents: ["read", "create", "update"],
    tags: ["read"],
    properties: ["read"],
    documentTypes: ["read"],
    storagePaths: ["read"],
    workflows: ["read"],
  }),
};

export type OrgRole = keyof typeof roles;

export type OrgPermissions = Parameters<(typeof roles)["owner"]["authorize"]>[0];

// ── Shared internal ─────────────────────────────────────────────────────────

// Better Auth stores a role as a single comma-joined string ("owner,admin"), so every check must
// split before comparing. A missing role (no membership, or still loading on the client) → [],
// which makes every downstream check fall through to "not allowed".
function heldRoles(role: string | null | undefined): string[] {
  return role ? role.split(",") : [];
}

// ── Org axis: checks (member.role) ──────────────────────────────────────────

// Fine-grained capability check against the access-control statement above. Grant if ANY of the
// member's roles authorizes the requested permissions. This is the primitive; prefer the coarser
// helpers below for plain section gating.
export function hasOrgPermission(
  role: string | null | undefined,
  permissions: OrgPermissions,
): boolean {
  return heldRoles(role).some((r) => {
    const grant = roles[r as OrgRole];
    return grant ? grant.authorize(permissions).success : false;
  });
}

// Coarse capability: may this member reach the org-admin surface (settings, taxonomy)?
export function canManageOrg(role: string | null | undefined): boolean {
  const held = heldRoles(role);
  return held.includes("owner") || held.includes("admin");
}

// Role identity: is this member an owner? (e.g. owner-only danger zone, or locking an owner row.)
export function isOrgOwner(role: string | null | undefined): boolean {
  return heldRoles(role).includes("owner");
}

// ── Instance axis: checks (user.role) ───────────────────────────────────────

// Role identity: is this user an instance admin? Binary (no tiering) — gates instance-wide config.
export function isInstanceAdmin(role: string | null | undefined): boolean {
  return heldRoles(role).includes("admin");
}
