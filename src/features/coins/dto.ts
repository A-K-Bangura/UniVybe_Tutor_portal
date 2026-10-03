import { z } from "zod";
export const exchangeSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    coins: z.number().int().positive(),
    leone_amount: z.union([
      z.number().positive(),
      z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .refine((value) => Number(value) > 0, "Payout must be positive"),
    ]),
    currency: z.string().min(1),
    mobile_money_number: z.string().min(1),
    status: z.enum([
      "pending",
      "processing",
      "completed",
      "rejected",
      "failed",
    ]),
  })
  .passthrough();
