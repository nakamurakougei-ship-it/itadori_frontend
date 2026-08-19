import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "イタドリ（木取りアプリ）",
  description: "定尺板から効率よく木取りを行うためのアプリです。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
