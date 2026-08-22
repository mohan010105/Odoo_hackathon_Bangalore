import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { NavItem } from "@/config/navigation";

/** Turn a URL segment into a readable crumb when no nav entry matches it. */
function humanise(segment: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return "Details";
  return segment.replace(/[-_]/g, " ").replace(/^\w/, (character) => character.toUpperCase());
}

export type Crumb = { label: string; to?: string };

/** Build crumbs from the pathname, preferring navigation labels for known paths. */
export function crumbsFor(items: readonly NavItem[], pathname: string, rootTo: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Dayflow", to: rootTo }];

  let path = "";
  for (const [index, segment] of segments.entries()) {
    path += `/${segment}`;
    if (index === 0) continue; // workspace prefix ("admin" / "employee")
    const navMatch = items.find((item) => item.to === path);
    crumbs.push({
      label: navMatch?.label ?? humanise(segment),
      ...(index < segments.length - 1 ? { to: path } : {}),
    });
  }
  return crumbs;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            // The separator is a sibling <li>, never nested inside the item.
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem>
                {crumb.to && !isLast ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
