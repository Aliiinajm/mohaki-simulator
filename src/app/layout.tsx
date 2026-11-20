import type { Metadata } from "next";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "محاكي نبض | منصة المحاكاة العلمية التفاعلية",
  description: "محاكي نبض: محاكاة التفاعلات الكيميائية، مستكشف المركبات ثلاثي الأبعاد، والذكاء الصناعي في الزراعة.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#050b18] text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-[0.35]" />
        <div className="pointer-events-none fixed -top-40 right-[-10%] -z-10 h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="pointer-events-none fixed bottom-[-20%] left-[-10%] -z-10 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
