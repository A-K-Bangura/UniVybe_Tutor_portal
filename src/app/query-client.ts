import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: false, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
