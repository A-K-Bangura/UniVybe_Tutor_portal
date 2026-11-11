import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "./query-client";
import { router } from "./router";
import { useSession } from "../shared/auth/session";
import {
  setInvalidator,
  setInactiveHandler,
  changeGeneration,
} from "../shared/api/client";
import { configError } from "./config";
import { ErrorPanel } from "../shared/ui/primitives";
export function Providers() {
  const bootstrap = useSession((s) => s.bootstrap);
  useEffect(() => {
    setInactiveHandler(() => {
      changeGeneration();
      useSession.setState({
        state: "restricted",
        user: useSession.getState().user
          ? { ...useSession.getState().user!, status: "inactive" }
          : undefined,
        error:
          "Your administrative account is not active. Contact another administrator or check your account state.",
      });
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    setInvalidator(() => {
      useSession.getState().clear();
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    void bootstrap();
  }, [bootstrap]);
  return configError ? (
    <ErrorPanel error={new Error(configError)} />
  ) : (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors />
    </QueryClientProvider>
  );
}
