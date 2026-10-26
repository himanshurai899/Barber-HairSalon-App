import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@/lib/access";
import { requirePage } from "@/lib/session";

async function Shell({ roles, links, children }: { roles: Role[]; links: [string, string][]; children: ReactNode }) {
  const actor = await requirePage(roles);
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl flex-col px-4 md:flex-row md:items-center md:justify-between md:gap-x-4">
          <nav aria-label="Staff" className="-mx-4 flex items-center overflow-x-auto whitespace-nowrap px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 shrink-0 items-center pr-4 text-sm hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="flex items-center justify-end gap-2 text-sm text-muted">
            <ThemeToggle compact />
            <span className="capitalize">{actor.role}</span>
            <button type="submit" className="inline-flex min-h-11 items-center underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>
    </>
  );
}

/** Wrap a staff or admin layout: checks the session before rendering anything inside. */
export function StaffShell(props: { roles: Role[]; links: [string, string][]; children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-4 text-muted">Loading…</p>}>
      <Shell {...props} />
    </Suspense>
  );
}
