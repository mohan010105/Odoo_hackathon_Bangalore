import { BookOpen, LifeBuoy, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const topics = [
  {
    icon: BookOpen,
    title: "Getting started",
    body: "Your workspace navigation on the left groups Dayflow into People, Operations and Pay. Collapse the sidebar from the header to widen any table.",
  },
  {
    icon: LifeBuoy,
    title: "Need a change?",
    body: "Employee records, attendance corrections and leave decisions are handled by your HR administrators from the admin workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Account security",
    body: "Update your password from My profile. Dayflow signs you out automatically after a period of inactivity on shared devices.",
  },
];

export function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Help"
        description="How Dayflow is organised, and where to go when you need a change."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {topics.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="space-y-2">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
