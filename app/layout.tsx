import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily English · 阶段驱动英语学习",
  description: "本地 Web 英语学习系统：阶段先于时长，保留真实学习记录和点词查询。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
