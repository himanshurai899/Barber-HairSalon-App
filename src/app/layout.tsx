import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Krishna Hair Salon, Gotri, Vadodara", template: "%s | Krishna Hair Salon" },
  description: "Book your hair appointment at Krishna Hair Salon, Gotri, Vadodara.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
