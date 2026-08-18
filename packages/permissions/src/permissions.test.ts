import { describe, expect, it } from "bun:test";
import { canManageOrg, hasOrgPermission, isInstanceAdmin, isOrgOwner } from "./permissions";

describe("permissions helper functions", () => {
  describe("canManageOrg", () => {
    it("returns true for owner and admin roles", () => {
      expect(canManageOrg("owner")).toBe(true);
      expect(canManageOrg("admin")).toBe(true);
    });

    it("returns false for regular member", () => {
      expect(canManageOrg("member")).toBe(false);
    });

    it("handles comma-separated roles from better-auth", () => {
      expect(canManageOrg("member,admin")).toBe(true);
      expect(canManageOrg("member,owner")).toBe(true);
      expect(canManageOrg("member,guest")).toBe(false);
    });

    it("returns false for falsy or empty roles", () => {
      expect(canManageOrg(null)).toBe(false);
      expect(canManageOrg(undefined)).toBe(false);
      expect(canManageOrg("")).toBe(false);
    });
  });

  describe("isOrgOwner", () => {
    it("returns true only if owner role is present", () => {
      expect(isOrgOwner("owner")).toBe(true);
      expect(isOrgOwner("admin,owner")).toBe(true);
      expect(isOrgOwner("admin")).toBe(false);
      expect(isOrgOwner("member")).toBe(false);
      expect(isOrgOwner(null)).toBe(false);
    });
  });

  describe("isInstanceAdmin", () => {
    it("returns true when instance admin role is present", () => {
      expect(isInstanceAdmin("admin")).toBe(true);
      expect(isInstanceAdmin("user,admin")).toBe(true);
      expect(isInstanceAdmin("user")).toBe(false);
      expect(isInstanceAdmin(null)).toBe(false);
    });
  });

  describe("hasOrgPermission", () => {
    it("grants full access to owner and admin", () => {
      expect(hasOrgPermission("owner", { documents: ["delete"] })).toBe(true);
      expect(hasOrgPermission("admin", { documents: ["delete"] })).toBe(true);
      expect(hasOrgPermission("admin", { workflows: ["create"] })).toBe(true);
    });

    it("allows member to read and create documents, but not delete", () => {
      expect(hasOrgPermission("member", { documents: ["read"] })).toBe(true);
      expect(hasOrgPermission("member", { documents: ["create"] })).toBe(true);
      expect(hasOrgPermission("member", { documents: ["update"] })).toBe(true);
      expect(hasOrgPermission("member", { documents: ["delete"] })).toBe(false);
    });

    it("restricts member from modifying sensitive resources like storagePaths or workflows", () => {
      expect(hasOrgPermission("member", { storagePaths: ["read"] })).toBe(true);
      expect(hasOrgPermission("member", { storagePaths: ["create"] })).toBe(false);
      expect(hasOrgPermission("member", { workflows: ["update"] })).toBe(false);
    });

    it("returns false when role is missing or invalid", () => {
      expect(hasOrgPermission(null, { documents: ["read"] })).toBe(false);
      expect(hasOrgPermission(undefined, { documents: ["read"] })).toBe(false);
      expect(hasOrgPermission("unknown_role", { documents: ["read"] })).toBe(false);
    });
  });
});
