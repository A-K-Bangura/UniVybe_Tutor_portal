import { it, expect } from "vitest";
import { exchangeSchema } from "./dto";
it("requires the recorded payout snapshot before exposing settlement controls", () => {
  const snapshot = {
    id: 5,
    coins: 1000,
    leone_amount: "100.00",
    currency: "SLE",
    mobile_money_number: "+23200000000",
    status: "processing",
  };
  expect(exchangeSchema.safeParse(snapshot).success).toBe(true);
  expect(
    exchangeSchema.safeParse({ ...snapshot, leone_amount: undefined }).success,
  ).toBe(false);
  expect(
    exchangeSchema.safeParse({ ...snapshot, status: "paid" }).success,
  ).toBe(false);
});
