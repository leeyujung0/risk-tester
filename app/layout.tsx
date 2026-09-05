import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Risk Tester | 포트폴리오 스트레스 테스터",
  description: "몬테카를로 시뮬레이션과 AI로 내 포트폴리오의 진짜 위험을 확인하세요",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
