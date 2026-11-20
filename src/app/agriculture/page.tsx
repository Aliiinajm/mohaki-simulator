import type { Metadata } from "next";
import { AgriPlanner } from "@/components/agri/AgriPlanner";

export const metadata: Metadata = { title: "الذكاء الصناعي في الزراعة | محاكي نبض" };

export default function AgriculturePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/5 px-3 py-1 text-xs font-semibold text-emerald-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> السكشن الثاني • صور أقمار صناعية · OpenStreetMap · Open-Meteo
        </div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">
          الذكاء الصناعي في <span className="glow-text">الزراعة</span>
        </h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-400">
          حدد أي منطقة في العالم على الخريطة، ودع الذكاء الاصطناعي يحلل صور الأقمار الصناعية ليميز التربة والشوارع والبيوت والمياه والأشجار القائمة، ثم يوزّع الأشجار المناسبة لمناخها ويحسب عددها وأثرها في خفض التلوث ودرجة الحرارة.
        </p>
      </div>
      <AgriPlanner />
    </div>
  );
}
