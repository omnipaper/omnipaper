import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  documents: ["read", "create", "delete"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    documents: ["read", "create", "delete"],
    settings: ["read", "update"],
  }),
  user: ac.newRole({
    documents: ["read", "create"],
  }),
};
