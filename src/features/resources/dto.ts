import { z } from "zod";
export const resourceSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    status: z.enum(["pending_approval", "approved", "rejected"]),
    permissions: z.object({ can_edit: z.boolean(), can_delete: z.boolean() }),
  })
  .passthrough();
