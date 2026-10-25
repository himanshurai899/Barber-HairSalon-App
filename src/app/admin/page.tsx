import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminHome() {
  return (
    <main className="space-y-4">
      <h1 className="font-serif text-3xl">Dashboard</h1>
      <p className="text-muted">Admin tools are added here as they land.</p>
    </main>
  );
}
