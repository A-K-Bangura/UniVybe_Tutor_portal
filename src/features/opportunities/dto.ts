import { z } from "zod";
export const opportunitySchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    status: z.enum([
      "draft",
      "pending_approval",
      "rejected",
      "published",
      "closed",
      "unpublished",
    ]),
    permissions: z.object({
      can_edit: z.boolean(),
      can_delete: z.boolean(),
      can_submit: z.boolean(),
    }),
    is_open: z.boolean().optional(),
    closed_reason: z.string().nullable().optional(),
  })
  .passthrough();
