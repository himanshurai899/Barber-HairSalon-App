import type { Metadata } from "next";

export const metadata: Metadata = { title: "Requests", robots: { index: false } };

export default function StaffHome() {
  return (
    <main className="space-y-4">
      <h1 className="font-serif text-3xl">Requests</h1>
      <p className="text-muted">Pending booking requests will appear here.</p>
    </main>
  );
}
