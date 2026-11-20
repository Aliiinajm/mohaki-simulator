"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/chemistry", label: "محاكي التفاعلات الكيميائية" },
  { href: "/agriculture", label: "الذكاء الصناعي في الزراعة" },
];

export function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-cyan-400/10 bg-[#050b18]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight">محاكي نبض</div>
            <div className="text-[11px] text-cyan-300/70">NABD SIMULATOR</div>
          </div>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active ? "bg-cyan-400/15 text-cyan-200" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <Link href="/chemistry" className="hidden rounded-xl bg-gradient-to-l from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.03] md:block">
          ابدأ المحاكاة
        </Link>
        <button className="rounded-lg p-2 text-slate-200 md:hidden" onClick={() => setOpen(!open)} aria-label="القائمة">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} strokeLinecap="round" />
          </svg>
        </button>
      </nav>
      {open && (
        <div className="border-t border-white/5 px-4 pb-4 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-slate-200 hover:bg-white/5">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
