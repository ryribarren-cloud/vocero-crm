import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionOrNull, requireSession, UnauthorizedError } from "@/lib/auth/session";

const { resolveMembership } = vi.hoisted(() => ({ resolveMembership: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { getSession: async () => ({ user: { id: "user-1" } }) } }),
}));
vi.mock("@/server/auth/on-signup", () => ({ resolveMembership }));

describe("barber access", () => {
  beforeEach(() => {
    resolveMembership.mockResolvedValue({ id: "member-1", organizationId: "org-1", role: "barber" });
  });

  it("denies the general CRM session and allows the dedicated view", async () => {
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getSessionOrNull({ allowBarber: true })).resolves.toMatchObject({
      role: "barber",
      memberId: "member-1",
      organizationId: "org-1",
    });
  });

  it("keeps regular member and owner sessions available", async () => {
    for (const role of ["member", "owner"]) {
      resolveMembership.mockResolvedValue({ id: "member-1", organizationId: "org-1", role });
      await expect(requireSession()).resolves.toMatchObject({ role });
    }
  });
});
