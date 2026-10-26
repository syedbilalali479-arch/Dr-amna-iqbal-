import type { Metadata } from "next";
import "./globals.css";
import "./brain.css";
import "./staff-access.css";

export const metadata: Metadata = {
  title: "Skinuvia — ClinicOS",
  description: "Clinic operations for Skinuvia by Dr. Amna Iqbal.",
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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
