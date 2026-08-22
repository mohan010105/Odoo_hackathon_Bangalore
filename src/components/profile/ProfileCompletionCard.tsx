import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ProfileCompletion } from "@/lib/profile/completion";

/** Progress indicator plus a per-field checklist for "My profile". */
export function ProfileCompletionCard({ completion }: { completion: ProfileCompletion }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-display text-base">Profile completion</CardTitle>
          <span className="font-display text-lg" aria-hidden="true">
            {completion.percent}%
          </span>
        </div>
        <Progress
          value={completion.percent}
          className="h-2"
          aria-label={`Profile ${completion.percent}% complete`}
        />
        <CardDescription>
          {completion.isComplete
            ? "Your profile has everything we need. Thank you!"
            : `${completion.missingRequired.length} required field${
                completion.missingRequired.length === 1 ? "" : "s"
              } still to fill in.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {completion.fields.map((field) => (
            <li key={field.id} className="flex items-start gap-2 text-sm">
              {field.complete ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 text-primary" />
              ) : field.required ? (
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 text-destructive" />
              ) : (
                <Circle aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
              )}
              <span>
                <span
                  className={cn(
                    "font-medium",
                    !field.complete && field.required && "text-destructive",
                  )}
                >
                  {field.label}
                  {field.required ? "" : " (optional)"}
                </span>
                {!field.complete ? (
                  <span className="block text-xs text-muted-foreground">{field.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
