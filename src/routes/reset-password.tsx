import { createFileRoute } from "@tanstack/react-router";

import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Dayflow HRMS" },
      {
        name: "description",
        content: "Choose a new password for your Dayflow HR workspace account.",
      },
      { property: "og:title", content: "Set a new password — Dayflow HRMS" },
      {
        property: "og:description",
        content: "Choose a new password for your Dayflow HR workspace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});
