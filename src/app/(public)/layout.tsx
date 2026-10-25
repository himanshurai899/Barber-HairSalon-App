import Link from "next/link";
import { Suspense } from "react";
import { digits, whatsappLink } from "@/lib/format";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSettings } from "@/lib/shop";

const DEFAULT_NAME = "Krishna Hair Salon";

function Header({ name }: { name: string }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-serif text-lg py-3 min-h-11 inline-flex items-center">
          {name}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link href="/services" className="inline-flex min-h-11 items-center px-3 hover:underline">
            Services
          </Link>
          <Link href="/book" className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-bg">
            Book
          </Link>
        </nav>
      </div>
    </header>
  );
}

async function HeaderWithName() {
  return <Header name={(await getSettings()).name} />;
}

const bar = "inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-line text-sm";

async function Footer() {
  const s = await getSettings();
  return (
    <>
      <footer className="mt-16 border-t border-line">
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-8 text-sm text-muted">
          <p className="text-ink">{s.name}</p>
          <p>{s.address}</p>
          <div className="flex items-center justify-between">
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline">
              Privacy
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </footer>
      <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface p-2 md:hidden">
        <div className="flex gap-2">
          <Link href="/book" className={`${bar} border-ink bg-ink text-bg`}>
            Book
          </Link>
          {s.whatsappNumber && (
            <a href={whatsappLink(s.whatsappNumber, s.name)} className={bar}>
              WhatsApp
            </a>
          )}
          {s.phone && (
            <a href={`tel:+${digits(s.phone)}`} className={bar}>
              Call
            </a>
          )}
        </div>
      </nav>
    </>
  );
}

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="pb-20 md:pb-0">
      <Suspense fallback={<Header name={DEFAULT_NAME} />}>
        <HeaderWithName />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
