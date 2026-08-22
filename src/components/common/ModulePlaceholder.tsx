import { PageHeader } from "./PageHeader";
import { EmptyState } from "./states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ModuleSection = {
  title: string;
  note: string;
};

/**
 * Shared shell for modules whose functionality arrives in a later phase.
 * Shows honest empty states instead of invented data.
 */
export function ModulePlaceholder({
  title,
  description,
  emptyTitle,
  emptyDescription,
  sections = [],
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  sections?: ModuleSection[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
      {sections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{section.note}</CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
