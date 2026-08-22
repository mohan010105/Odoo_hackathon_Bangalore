import { createFileRoute } from "@tanstack/react-router";

import { ChangePasswordPage } from "@/pages/auth/ChangePasswordPage";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Change your password — Dayflow" },
      { name: "description", content: "Replace your temporary Dayflow password." },
      { property: "og:title", content: "Change your password — Dayflow" },
      { property: "og:description", content: "Set a new password for your Dayflow account." },
    ],
  }),
  component: ChangePasswordPage,
});
