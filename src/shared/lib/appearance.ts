import { create } from "zustand";
export const useAppearance = create<{
  theme: "light" | "dark";
  toggle: () => void;
}>((set) => ({
  theme: localStorage.getItem("univybe.theme") === "dark" ? "dark" : "light",
  toggle: () =>
    set((state) => {
      const theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("univybe.theme", theme);
      return { theme };
    }),
}));
