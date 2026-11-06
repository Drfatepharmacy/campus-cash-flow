import { describe, expect, it } from "vitest";
import { PermissionDenied, requirePermission, type AssociationContext } from "./association-access";

const context = (permissions: AssociationContext["permissions"]): AssociationContext => ({
  association: { id: "assoc-1" },
  permissions,
  roles: [],
  isSuperAdmin: false,
  isMember: true,
});

describe("association dashboard permissions", () => {
  it("allows finance and settlement reads only when the corresponding permission is present", () => {
    expect(() => requirePermission(context(["finance.view"]), "finance.view")).not.toThrow();
    expect(() => requirePermission(context(["settlement.view"]), "settlement.view")).not.toThrow();
    expect(() => requirePermission(context(["finance.view"]), "settlement.view")).toThrow(PermissionDenied);
  });

  it("does not allow a member without members.view to read the member roster", () => {
    expect(() => requirePermission(context([]), "members.view")).toThrow(PermissionDenied);
    expect(() => requirePermission(context(["members.view"]), "members.view")).not.toThrow();
  });
});