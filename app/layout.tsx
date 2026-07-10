import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "菁英班孵化系統 1.0",
  description: "希望學院．菁英班投資團隊 — 線上填寫平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
