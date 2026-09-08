import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const isAuth =
        localStorage.getItem("dvr_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("mehar_alive");

      if (!isAuth) {
        throw redirect({ to: "/auth" });
      }
    }
    return {};
  },
  component: AppLayout,
});
