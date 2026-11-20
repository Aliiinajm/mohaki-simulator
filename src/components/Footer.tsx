import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-cyan-400/10 bg-[#040914]/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xl font-extrabold">محاكي نبض</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">منصة علمية تفاعلية تجمع بين المعلوماتية الكيميائية والذكاء الصناعي لتقديم محاكاة دقيقة وسلسة.</p>
        </div>
        <div>
          <h4 className="mb-3 font-bold text-cyan-200">الأقسام</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/chemistry" className="hover:text-white">محاكي التفاعلات الكيميائية</Link></li>
            <li><Link href="/chemistry?tab=explorer" className="hover:text-white">مستكشف المركبات ثلاثي الأبعاد</Link></li>
            <li><Link href="/chemistry?tab=periodic" className="hover:text-white">الجدول الدوري التفاعلي</Link></li>
            <li><Link href="/agriculture" className="hover:text-white">الذكاء الصناعي في الزراعة</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-bold text-cyan-200">مصادر البيانات</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {["PubChem", "NCI CACTUS", "ChemSpider", "IBM RXN", "NIST", "ChEMBL", "OpenChemLib", "KaTeX", "3Dmol.js"].map((s) => (
              <span key={s} className="ltr rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-cyan-100/80">{s}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} محاكي نبض — جميع الحقوق محفوظة</div>
    </footer>
  );
}
