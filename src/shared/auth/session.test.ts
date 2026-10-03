import { describe, it, expect } from "vitest";
import { can } from "./session";
describe("role restrictions", () => {
  it("blocks educators from feed and contributors from courses", () => {
    expect(can("educator", "feed")).toBe(false);
    expect(can("contributor", "courses")).toBe(false);
    expect(can("contributor", "resources")).toBe(true);
  });
  it("keeps moderators out of financial and moderation actions", () => {
    expect(can("moderator", "coins")).toBe(false);
    expect(can("moderator", "reviews")).toBe(false);
    expect(can("moderator", "analytics")).toBe(true);
  });
});
