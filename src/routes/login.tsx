import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/pages/auth/LoginPage";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Dayflow HRMS" },
      {
        name: "description",
        content: "Sign in to your Dayflow HR workspace with your work email.",
      },
      { property: "og:title", content: "Sign in — Dayflow HRMS" },
      { property: "og:description", content: "Access your Dayflow employee or HR workspace." },
    ],
  }),
  component: LoginPage,
});
