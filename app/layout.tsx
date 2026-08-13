import type { Metadata } from "next";
import "./globals.css";
import "./study/unit-modules/unit-study.css";

export const metadata: Metadata = {
  title: "Daily English · 英语(二)自学教程",
  description: "英语(二)自学教程 - 按单元学习单词、词组、语法、句子、练习、作文",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
