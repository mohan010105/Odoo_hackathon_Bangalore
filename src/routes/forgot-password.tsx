import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Dayflow HRMS" },
      {
        name: "description",
        content: "Request a Dayflow password reset link using your work email address.",
      },
      { property: "og:title", content: "Reset password — Dayflow HRMS" },
      {
        property: "og:description",
        content: "Request a Dayflow password reset link using your work email address.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});
