import type { Metadata } from "next";
import { ChemistryTabs } from "@/components/chem/ChemistryTabs";

export const metadata: Metadata = { title: "محاكي التفاعلات الكيميائية | محاكي نبض" };

export default async function ChemistryPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "explorer" || sp.tab === "periodic" ? sp.tab : "reactions";
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-semibold text-cyan-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> السكشن الأول • متصل بـ PubChem · CACTUS · ChemSpider · IBM RXN
        </div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">
          محاكي <span className="glow-text">التفاعلات الكيميائية</span>
        </h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-400">
          اختر متفاعلين، حدد الكميات بالمول ودرجة الحرارة والعامل الحفاز، ثم اضغط «تفاعل». يقوم المحرك بموازنة المعادلة، تحديد المتفاعل المحدد، حساب كتل النواتج والمتبقي، وتقدير المحتوى الحراري وسرعة التفاعل.
        </p>
      </div>
      <ChemistryTabs initialTab={tab} initialQuery={sp.q || ""} />
    </div>
  );
}
