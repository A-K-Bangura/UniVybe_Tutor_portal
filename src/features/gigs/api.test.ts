import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, afterEach } from "vitest";
import {
  adminActions,
  contentPayload,
  gigDetail,
  gigEntity,
  initialValues,
  settingsPayload,
} from "./api";
import { can } from "../../shared/auth/session";
const permissions = {
  can_edit: true,
  can_submit: true,
  can_delete: true,
  can_manage_settings: true,
  can_close: false,
  can_reopen: false,
  can_view_applicants: true,
  can_rate_workers: false,
};
const gig = {
  id: 1,
  status: "rejected",
  permissions,
  is_accepting_interest: false,
  category: { id: 7 },
  contact: { email: "gig@example.test" },
  application_deadline: "2027-12-31T19:45:32+00:00",
  capacity_type: "open",
  pricing_type: "negotiable",
  work_mode: "remote",
  skills: ["design"],
  tags: ["logo"],
};
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
describe("gig API boundaries", () => {
  it("preserves exact unchanged deadlines and never submits owner/status/account contacts", () => {
    const payload = contentPayload(
      {
        ...initialValues(gig),
        title: "Changed title",
        location: "Must disappear",
        address: "Must disappear",
      },
      gig,
      undefined,
      false,
    );
    expect(payload).not.toHaveProperty("application_deadline");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("creator_id");
    expect(payload).not.toHaveProperty("cover_image");
    expect(payload.contact_email).toBe("gig@example.test");
    expect(payload.contact_whatsapp).toBeNull();
    expect(payload.location).toBeNull();
    expect(payload.address).toBeNull();
    expect(payload.submit).toBe(false);
    expect(payload.skills).toEqual(["design"]);
  });
  it("clears deadlines explicitly and omits prohibited open capacity limits", () => {
    expect(
      settingsPayload(
        { capacity_type: "open", applicant_limit: 3, application_deadline: "" },
        gig,
      ),
    ).toEqual({ capacity_type: "open", application_deadline: null });
    expect(
      settingsPayload(
        {
          capacity_type: "limited",
          applicant_limit: "5",
          application_deadline: gig.application_deadline,
        },
        gig,
      ),
    ).toEqual({ capacity_type: "limited", applicant_limit: 5 });
  });
  it("submits registered Cloudinary IDs without display URLs; null removes a cover", () => {
    expect(
      contentPayload(
        initialValues(gig),
        gig,
        {
          source: "cloudinary",
          public_id: "own-cover",
          url: "https://example.test/display.jpg",
        },
        true,
      ).cover_image,
    ).toEqual({ source: "cloudinary", public_id: "own-cover" });
    expect(
      contentPayload(initialValues(gig), gig, null, false).cover_image,
    ).toBeNull();
  });
  it("rejects public/incomplete permission shapes and exposes no publish shortcut", () => {
    expect(() =>
      gigEntity({ data: { gig: { ...gig, status: "open" } } }),
    ).toThrow();
    expect(() =>
      gigEntity({ data: { gig: { ...gig, permissions: { can_edit: true } } } }),
    ).toThrow();
    expect(adminActions({ status: "draft" })).toEqual([]);
    expect(adminActions({ status: "pending_approval" })).toEqual([
      "approve",
      "reject",
    ]);
    expect(
      adminActions({ status: "published", deleted_at: "2026-10-07" }),
    ).toEqual([]);
    for (const role of ["admin", "tutor", "educator", "contributor"] as const)
      expect(can(role, "gigs")).toBe(true);
    expect(can("moderator", "gigs")).toBe(false);
    expect(can("tutor", "gigs-admin")).toBe(false);
  });
  it("reads admin audit events from data.events beside data.gig", async () => {
    server.use(
      http.get("*/api/v1/admin/gigs/1", () =>
        HttpResponse.json({
          success: true,
          data: {
            gig,
            events: [
              {
                event: "rejected",
                by: { type: "creation_user", name: "Reviewer" },
              },
            ],
          },
        }),
      ),
    );
    expect((await gigDetail("1", true)).events).toEqual([
      { event: "rejected", by: { type: "creation_user", name: "Reviewer" } },
    ]);
  });
});
