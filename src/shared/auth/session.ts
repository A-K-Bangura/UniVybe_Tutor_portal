import { create } from "zustand";
import { z } from "zod";
import {
  request,
  object,
  changeGeneration,
  getGeneration,
} from "../api/client";
export const roleSchema = z.enum([
  "admin",
  "educator",
  "tutor",
  "contributor",
  "moderator",
]);
export type Role = z.infer<typeof roleSchema>;
const userSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    email: z.string(),
    status: z.string(),
    role: z.object({ name: roleSchema, id: z.number().optional() }),
  })
  .passthrough();
export type User = z.infer<typeof userSchema>;
type State =
  | "booting"
  | "anonymous"
  | "onboarding"
  | "restricted"
  | "ready"
  | "unavailable";
interface Session {
  state: State;
  user?: User;
  error?: string;
  bootstrap: () => Promise<void>;
  authenticate: (data: unknown) => Promise<void>;
  clear: () => void;
}
let bootstrapAttempt = 0;
export const useSession = create<Session>((set, get) => ({
  state: "booting",
  clear: () => {
    bootstrapAttempt++;
    changeGeneration();
    sessionStorage.removeItem("univybe.token");
    set({ state: "anonymous", user: undefined, error: undefined });
  },
  bootstrap: async () => {
    const attempt = ++bootstrapAttempt;
    if (!sessionStorage.getItem("univybe.token")) {
      set({ state: "anonymous" });
      return;
    }
    const generation = getGeneration();
    set({ state: "booting", error: undefined });
    try {
      await request("tutor/auth/check");
      const response = await request("tutor/auth/profile");
      const data = object(response.data),
        user = userSchema.parse(data.user);
      if (generation !== getGeneration() || attempt !== bootstrapAttempt)
        return;
      const incomplete =
        user.status === "pending" &&
        (!user.firstname ||
          !user.lastname ||
          !user.phone ||
          (user.role.name !== "admin" && !user.qualification));
      set({
        user,
        state:
          data.requires_onboarding === true || incomplete
            ? "onboarding"
            : user.status === "approved"
              ? "ready"
              : "restricted",
      });
    } catch (error) {
      if (
        generation === getGeneration() &&
        attempt === bootstrapAttempt &&
        get().state !== "anonymous"
      )
        set({
          state: "unavailable",
          error: error instanceof Error ? error.message : "Session unavailable",
        });
    }
  },
  authenticate: async (value) => {
    const data = object(value);
    const token = z.string().min(1).parse(data.token);
    changeGeneration();
    sessionStorage.setItem("univybe.token", token);
    if (data.requires_onboarding === true) {
      set({ state: "onboarding", user: userSchema.parse(data.user) });
      return;
    }
    await get().bootstrap();
  },
}));
export const can = (role: Role, area: string) => {
  if (["profile", "security", "dashboard"].includes(area)) return true;
  if (["analytics", "reports", "system-health", "search"].includes(area))
    return (
      ["admin", "moderator", "educator", "tutor"].includes(role) &&
      (area !== "system-health" || ["admin", "moderator"].includes(role))
    );
  if (area === "courses") return ["admin", "educator", "tutor"].includes(role);
  if (area === "feed") return ["admin", "tutor", "contributor"].includes(role);
  if (["resources", "opportunities", "gigs"].includes(area))
    return role !== "moderator";
  return role === "admin";
};
