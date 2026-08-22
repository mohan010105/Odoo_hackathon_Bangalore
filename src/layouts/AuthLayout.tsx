import type { ReactNode } from "react";

import { Brand } from "@/components/common/Brand";
import { clientEnv } from "@/config/env";

/**
 * Split authentication canvas: brand story on the left, focused form card on
 * the right. Collapses to the card alone on small screens and stays within the
 * viewport on ordinary desktop resolutions.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
  highlights = DEFAULT_HIGHLIGHTS,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  highlights?: readonly string[];
}) {
  return (
    <div className="auth-canvas min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border/70 px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="grid-lines pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div className="relative space-y-8">
          <Brand />
          <div className="space-y-4">
            <h2 className="max-w-md font-display text-3xl leading-tight font-semibold tracking-tight text-foreground">
              {clientEnv.appTagline}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              One connected workspace for employee management, attendance, leave, payroll and Odoo
              integration.
            </p>
          </div>
          <ul className="space-y-2.5">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Abstract workflow rail: employee data flowing through to Odoo. */}
        <div className="relative space-y-3" aria-hidden="true">
          <div className="flex flex-wrap items-center gap-2">
            {["Employee", "Attendance", "Leave", "Payroll", "Odoo"].map((step, index) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {step}
                </span>
                {index < 4 ? <span className="text-xs text-border">→</span> : null}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Every record flows one way, with a full audit trail.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center lg:hidden">
            <Brand withTagline />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card-hover)] sm:p-8">
            <div className="space-y-1.5">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="mt-6">{children}</div>
          </div>

          {footer ? (
            <p className="text-center text-xs text-muted-foreground">{footer}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

const DEFAULT_HIGHLIGHTS = [
  "Workforce management",
  "Smart attendance",
  "Leave & payroll automation",
  "Odoo integration",
] as const;
