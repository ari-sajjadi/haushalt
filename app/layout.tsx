import type { Metadata } from "next";
import "./globals.css";
import "./features.css";

export const metadata: Metadata = {
  title: "HausHalt – Gemeinsam den Überblick behalten",
  description: "Der Schweizer Alltagsbudget- und Rechnungs-Tracker für Familien, Paare und WGs.",
  metadataBase: new URL("https://haushalt.ari-sajadi.chatgpt.site"),
  openGraph: {
    title: "HausHalt – Gemeinsam den Überblick behalten",
    description: "Rechnungen, Budgets und faire Kostenaufteilung für Schweizer Haushalte.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "HausHalt Dashboard" }],
  },
  twitter: { card: "summary_large_image", title: "HausHalt", description: "Gemeinsam den Überblick behalten", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
