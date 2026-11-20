import Link from "next/link";
import { HomeStats } from "@/components/HomeStats";

const PIPELINE = [
  { n: "01", t: "إدخال ذكي", d: "بحث فوري مع اقتراحات تلقائية (Debounce 300ms) بالعربية والإنجليزية." },
  { n: "02", t: "توحيد البيانات", d: "ذاكرة مؤقتة ← PubChem ← NCI CACTUS ← ChemSpider مع احترام حد 5 طلبات/ثانية." },
  { n: "03", t: "معاينة فورية", d: "رسم الصيغة البنائية مباشرة في المتصفح عبر OpenChemLib دون طلبات إضافية." },
  { n: "04", t: "محرك التفاعل", d: "قواعد كيميائية + موازنة جبرية دقيقة + IBM RXN للتفاعلات العضوية المعقدة." },
  { n: "05", t: "الحسابات", d: "المتفاعل المحدد، كتل النواتج، المتبقي، ΔH، وسرعة التفاعل (أرينيوس)." },
  { n: "06", t: "العرض", d: "معادلة موزونة بـ KaTeX، جزيئات ثنائية وثلاثية الأبعاد، وتقرير كامل." },
];

const SOURCES = [
  { n: "PubChem", d: "المصدر الرئيسي: الصيغ، SMILES، الخصائص، النماذج 3D" },
  { n: "NCI CACTUS", d: "نظام احتياطي لتحويل الأسماء إلى بنى كيميائية" },
  { n: "ChemSpider", d: "قاعدة بيانات الجمعية الملكية للكيمياء (RSC)" },
  { n: "IBM RXN", d: "تنبؤ بنواتج التفاعلات العضوية بالذكاء الاصطناعي" },
  { n: "OpenChemLib", d: "رسم الجزيئات وتوليد التشكّلات ثلاثية الأبعاد" },
  { n: "3Dmol.js", d: "عارض جزيئي تفاعلي ثلاثي الأبعاد" },
  { n: "KaTeX + mhchem", d: "عرض المعادلات الكيميائية الموزونة بدقة" },
  { n: "NIST · ChEMBL · ChEBI", d: "روابط مباشرة لقواعد البيانات العلمية" },
];

export default function Home() {
  return (
    <div>
      {/* Developer */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="glass fade-up flex flex-wrap items-center justify-between gap-4 rounded-2xl border-cyan-400/20 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-2xl shadow-lg shadow-cyan-500/20">👨‍🔬</div>
            <div>
              <div className="text-xs font-semibold text-cyan-300">مطور الموقع</div>
              <div className="text-lg font-extrabold text-white">علي نجم عبدالنبي</div>
              <div className="text-sm text-slate-400">قسم الهندسة الكيمياوية — جامعة الكوفة</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://instagram.com/66.6se"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-pink-400/30 bg-gradient-to-l from-pink-500/15 to-orange-400/15 px-4 py-2 text-sm font-bold text-pink-100 transition hover:scale-[1.03] hover:border-pink-400/60"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              <span className="ltr font-mono">66.6se</span>
            </a>
            <a href="tel:07838924374" className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:scale-[1.03] hover:border-emerald-400/60">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.9 2z" />
              </svg>
              <span className="ltr font-mono">07838924374</span>
            </a>
          </div>
        </div>
      </section>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-xs font-semibold text-cyan-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> منصة محاكاة علمية تفاعلية
            </div>
            <h1 className="text-5xl font-black leading-tight text-white sm:text-6xl lg:text-7xl">
              محاكي <span className="glow-text">نبض</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-9 text-slate-300">
              اكتشف الكيمياء كما لم تراها من قبل: ابحث عن أي مركب أو عنصر من ملايين السجلات العلمية، شاهد بنيته الذرية ثلاثية الأبعاد، وحاكِ التفاعلات الكيميائية بمعادلات موزونة وحسابات دقيقة.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/chemistry" className="rounded-2xl bg-gradient-to-l from-cyan-400 to-emerald-400 px-7 py-3.5 font-extrabold text-slate-900 shadow-xl shadow-cyan-500/25 transition hover:scale-[1.03]">
                ⚗️ ابدأ محاكاة تفاعل
              </Link>
              <Link href="/chemistry?tab=explorer" className="rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 font-bold text-white transition hover:bg-white/10">
                ⚛️ مستكشف المركبات
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="glass relative overflow-hidden rounded-[2rem] p-8">
              <svg viewBox="0 0 400 300" className="floaty w-full">
                <defs>
                  <linearGradient id="hg" x1="0" x2="1">
                    <stop stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#34d399" />
                  </linearGradient>
                  <radialGradient id="atomO" cx="35%" cy="35%">
                    <stop stopColor="#fda4af" />
                    <stop offset="1" stopColor="#e11d48" />
                  </radialGradient>
                  <radialGradient id="atomC" cx="35%" cy="35%">
                    <stop stopColor="#94a3b8" />
                    <stop offset="1" stopColor="#334155" />
                  </radialGradient>
                  <radialGradient id="atomH" cx="35%" cy="35%">
                    <stop stopColor="#ffffff" />
                    <stop offset="1" stopColor="#cbd5e1" />
                  </radialGradient>
                </defs>
                <g stroke="#64748b" strokeWidth="7" strokeLinecap="round">
                  <line x1="150" y1="150" x2="250" y2="150" />
                  <line x1="150" y1="150" x2="100" y2="80" />
                  <line x1="150" y1="150" x2="100" y2="220" />
                  <line x1="250" y1="150" x2="310" y2="90" />
                  <line x1="250" y1="150" x2="310" y2="210" />
                  <line x1="310" y1="210" x2="365" y2="240" />
                  <line x1="150" y1="150" x2="70" y2="150" />
                </g>
                <circle cx="150" cy="150" r="30" fill="url(#atomC)" />
                <circle cx="250" cy="150" r="30" fill="url(#atomC)" />
                <circle cx="310" cy="90" r="26" fill="url(#atomO)" />
                <circle cx="310" cy="210" r="26" fill="url(#atomO)" />
                <circle cx="100" cy="80" r="17" fill="url(#atomH)" />
                <circle cx="100" cy="220" r="17" fill="url(#atomH)" />
                <circle cx="365" cy="240" r="15" fill="url(#atomH)" />
                <circle cx="70" cy="150" r="17" fill="url(#atomH)" />
              </svg>
              <svg viewBox="0 0 400 60" className="pulse-line mt-2 w-full">
                <path d="M0 30 H120 L140 30 L155 5 L175 55 L195 15 L205 30 H400" fill="none" stroke="url(#hg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="ltr mt-3 text-center font-mono text-sm text-cyan-200/80">CH₃COOH • Acetic acid • 60.05 g/mol</div>
            </div>
          </div>
        </div>
        <div className="mt-16">
          <HomeStats />
        </div>
      </section>

      {/* Sections */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h2 className="mb-2 text-3xl font-black text-white">أقسام المنصة</h2>
        <p className="mb-8 text-slate-400">اختر القسم الذي تريد استكشافه</p>
        <div className="grid gap-6 md:grid-cols-2">
          <Link href="/chemistry" className="group glass relative overflow-hidden rounded-[2rem] p-8 transition hover:-translate-y-1 hover:border-cyan-400/40">
            <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl transition group-hover:bg-cyan-500/30" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-5xl">⚗️</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">متاح الآن</span>
              </div>
              <div className="text-sm font-semibold text-cyan-300">السكشن الأول</div>
              <h3 className="mt-1 text-2xl font-black text-white">محاكي التفاعلات الكيميائية</h3>
              <p className="mt-3 leading-8 text-slate-400">بحث فوري في قواعد البيانات العالمية، نماذج ذرية ثلاثية الأبعاد، موازنة المعادلات، المتفاعل المحدد، وكتل النواتج.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                {["محاكاة التفاعلات", "مستكشف 3D", "الجدول الدوري", "Stoichiometry"].map((t) => (
                  <span key={t} className="rounded-full bg-white/5 px-3 py-1 text-slate-300">{t}</span>
                ))}
              </div>
              <div className="mt-6 font-bold text-cyan-300 transition group-hover:translate-x-[-6px]">ادخل القسم ←</div>
            </div>
          </Link>
          <Link href="/agriculture" className="group glass relative overflow-hidden rounded-[2rem] p-8 transition hover:-translate-y-1 hover:border-emerald-400/40">
            <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-5xl">🌱</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">متاح الآن</span>
              </div>
              <div className="text-sm font-semibold text-emerald-300">السكشن الثاني</div>
              <h3 className="mt-1 text-2xl font-black text-white">الذكاء الصناعي في الزراعة</h3>
              <p className="mt-3 leading-8 text-slate-400">خريطة تفاعلية لأي مكان في العالم: حدد منطقة، ويحلل الذكاء الاصطناعي التربة والشوارع والمباني، ويوزع الأشجار ويحسب أثرها على التلوث والحرارة.</p>
              <div className="mt-6 font-bold text-emerald-300">استكشف ←</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h2 className="mb-2 text-3xl font-black text-white">كيف يعمل المحاكي؟</h2>
        <p className="mb-8 text-slate-400">خط معالجة بيانات متكامل من الإدخال حتى التقرير النهائي</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map((p) => (
            <div key={p.n} className="glass rounded-2xl p-6 transition hover:border-cyan-400/30">
              <div className="ltr text-start font-mono text-3xl font-black text-cyan-400/40">{p.n}</div>
              <h3 className="mt-2 text-lg font-bold text-white">{p.t}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h2 className="mb-2 text-3xl font-black text-white">مصادر البيانات والتقنيات المدمجة</h2>
        <p className="mb-8 text-slate-400">ربط موحد بين قواعد بيانات علمية عالمية عبر خادم وسيط آمن (بدون مشاكل CORS)</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map((s) => (
            <div key={s.n} className="glass rounded-2xl p-5">
              <div className="ltr text-start font-bold text-cyan-200">{s.n}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{s.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
