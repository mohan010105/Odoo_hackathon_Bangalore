import { Check, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, evaluatePassword } from "@/lib/validation/password";

/**
 * Live checklist and strength bar for a new password. Purely presentational —
 * the same rules are enforced by the schema on submit and by the auth provider.
 */
export function PasswordStrengthMeter({ value, id }: { value: string; id?: string }) {
  const strength = evaluatePassword(value);

  return (
    <div className="space-y-2" id={id}>
      <div className="flex items-center justify-between gap-2">
        <Progress
          value={value ? strength.score : 0}
          aria-label="Password strength"
          className="h-2"
        />
        <span
          aria-live="polite"
          className={cn(
            "shrink-0 text-xs font-medium",
            strength.label === "Strong" && "text-primary",
            strength.label === "Good" && "text-accent-foreground",
            (strength.label === "Weak" || strength.label === "Too weak") && "text-muted-foreground",
          )}
        >
          {value ? strength.label : "Enter a password"}
        </span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = strength.satisfied[rule.id] === true;
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                ok ? "text-primary" : "text-muted-foreground",
              )}
            >
              {ok ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <X aria-hidden="true" className="size-3.5" />
              )}
              <span>{rule.label}</span>
              <span className="sr-only">{ok ? "requirement met" : "requirement not met"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
