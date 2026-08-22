import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";

export const Route = createFileRoute("/employee/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Dayflow" },
      {
        name: "description",
        content: "Manage your Dayflow preferences, notifications and account security.",
      },
      { property: "og:title", content: "Settings — Dayflow" },
      {
        property: "og:description",
        content: "Manage your Dayflow preferences, notifications and account security.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Settings"
      description="Personal preferences for your Dayflow workspace."
      emptyTitle="Nothing to configure yet"
      emptyDescription="Your editable details and password live on My profile. Notification and display preferences arrive in a later phase."
      sections={[
        { title: "Profile", note: "Update your photo, phone and location from My profile." },
        { title: "Security", note: "Change your password from the card on My profile." },
        { title: "Notifications", note: "Review in-app alerts from the Notifications page." },
      ]}
    />
  ),
});
