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
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 px-4">
          <nav aria-label="Staff" className="flex flex-wrap items-center">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center pr-4 text-sm hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="flex items-center gap-2 text-sm text-muted">
            <ThemeToggle />
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
