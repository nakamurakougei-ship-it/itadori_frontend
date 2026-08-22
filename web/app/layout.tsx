import type { Metadata } from "next";
import "./globals.css";

const siteTitle =
  "イタドリ | 木工・DIY専用の板割り・木取り計算Webアプリ【無料・自動生成】";
const siteDescription =
  "合板や板材の木取り・カット寸法を自動で最適化し、歩留まりを最大化する木工計算Webツール。面倒な手計算や手書き図面をなくし、直感的なカット図をブラウザですぐに自動生成します。登録不要・完全無料。";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "木取り",
    "木拾い",
    "板割り",
    "合板 計算",
    "木工 カット図",
    "歩留まり 最適化",
    "DIY 木材拾い",
    "イタドリ",
  ],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    locale: "ja_JP",
    type: "website",
  },
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
