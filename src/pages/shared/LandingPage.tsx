import { Link } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, Wallet } from "lucide-react";

import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/config/env";
import { useAuth } from "@/hooks/useAuth";
import { homeRouteForRole } from "@/lib/permissions";

const pillars = [
  {
    icon: ShieldCheck,
    title: "Role-aware access",
    body: "Separate employee and HR workspaces with centralised permissions.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance & leave",
    body: "Check-in, time-off requests and approval workflows in one flow.",
  },
  {
    icon: Wallet,
    title: "Payroll visibility",
    body: "Salary structures and payslip transparency for both sides.",
  },
];

export function LandingPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        {!isLoading && user ? (
          <Button asChild size="sm">
            <Link to={homeRouteForRole(user.role)}>Open workspace</Link>
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/setup">Set up workspace</Link>
            </Button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="py-16 sm:py-24">
          <p className="font-display text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Human resource management
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {clientEnv.appTagline}
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Dayflow brings profiles, attendance, time-off and payroll into a single, calm workspace
            for employees and HR teams.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/setup">Set up workspace</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section aria-label="Platform highlights" className="grid gap-4 sm:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-xl border border-border bg-card p-5">
              <span
                aria-hidden="true"
                className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
              >
                <Icon className="size-4" />
              </span>
              <h2 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
