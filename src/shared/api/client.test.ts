import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";
import { page, entity, problem } from "./client";
describe("API contracts", () => {
  it("keeps legitimate zero totals and rejects malformed collections", () => {
    expect(
      page({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } })
        .total,
    ).toBe(0);
    expect(() => page({ data: { data: [] }, meta: { total: 0 } })).toThrow(
      "Unexpected collection",
    );
  });
  it("accepts nested pagination only for explicitly opted-in endpoints", () => {
    const response = {
      data: { data: [{ id: 1 }], total: 1, current_page: 1, last_page: 1 },
    };
    expect(page(response, true).items).toHaveLength(1);
    expect(() => page(response)).toThrow();
  });
  it("does not invent missing entity IDs", () => {
    expect(() =>
      entity({ data: { course: { title: "Incomplete" } } }, "course"),
    ).toThrow();
  });
  it("preserves indexed validation while hiding internal exception text", () => {
    const validation = problem(
      new AxiosError("Failure", undefined, undefined, undefined, {
        status: 422,
        data: {
          error: {
            message: "Validation failed",
            details: { "actions.0.url": ["Invalid URL"] },
          },
        },
        headers: {},
        statusText: "",
        config: { headers: {} },
      } as never),
    );
    expect(validation.fields["actions.0.url"]).toEqual(["Invalid URL"]);
    const missing = problem(
      new AxiosError("Failure", undefined, undefined, undefined, {
        status: 404,
        data: {
          message: "No query results for model App\\Models\\Resource 42",
        },
        headers: {},
        statusText: "",
        config: { headers: {} },
      } as never),
    );
    expect(missing.message).not.toContain("App\\Models");
  });
  it("marks lost mutation responses as uncertain rather than successful", () => {
    expect(problem(new AxiosError("Network Error")).uncertain).toBe(true);
  });
});
