import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  documents: ["read", "create", "update", "delete"],
  tags: ["read", "create", "update", "delete"],
  properties: ["read", "create", "update", "delete"],
  documentTypes: ["read", "create", "update", "delete"],
  storagePaths: ["read", "create", "update", "delete"],
  workflows: ["read", "create", "update", "delete"],
  savedViews: ["read", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole({
    ...ownerAc.statements,
    documents: ["read", "create", "update", "delete"],
    tags: ["read", "create", "update", "delete"],
    properties: ["read", "create", "update", "delete"],
    documentTypes: ["read", "create", "update", "delete"],
    storagePaths: ["read", "create", "update", "delete"],
    workflows: ["read", "create", "update", "delete"],
    savedViews: ["read", "create", "update", "delete"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    documents: ["read", "create", "update", "delete"],
    tags: ["read", "create", "update", "delete"],
    properties: ["read", "create", "update", "delete"],
    documentTypes: ["read", "create", "update", "delete"],
    storagePaths: ["read", "create", "update", "delete"],
    workflows: ["read", "create", "update", "delete"],
    savedViews: ["read", "create", "update", "delete"],
  }),
  member: ac.newRole({
    ...memberAc.statements,
    documents: ["read", "create", "update"],
    tags: ["read"],
    properties: ["read"],
    documentTypes: ["read"],
    storagePaths: ["read"],
    workflows: ["read"],
    savedViews: ["read", "create", "update", "delete"],
  }),
};

export type OrgRole = keyof typeof roles;

export type OrgPermissions = Parameters<(typeof roles)["owner"]["authorize"]>[0];

// Better Auth stores a role as a single comma-joined string ("owner,admin"), so split before comparing.
function heldRoles(role: string | null | undefined): string[] {
  return role ? role.split(",") : [];
}

export function hasOrgPermission(
  role: string | null | undefined,
  permissions: OrgPermissions,
): boolean {
  return heldRoles(role).some((r) => {
    const grant = roles[r as OrgRole];
    return grant ? grant.authorize(permissions).success : false;
  });
}

export function canManageOrg(role: string | null | undefined): boolean {
  const held = heldRoles(role);
  return held.includes("owner") || held.includes("admin");
}

export function isOrgOwner(role: string | null | undefined): boolean {
  return heldRoles(role).includes("owner");
}

export function isInstanceAdmin(role: string | null | undefined): boolean {
  return heldRoles(role).includes("admin");
}
