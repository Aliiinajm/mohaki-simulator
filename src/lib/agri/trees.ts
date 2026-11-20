// Tree species database (values are typical mature-tree estimates compiled from i-Tree / USDA Forest Service
// literature and arboriculture references; used for planning-level estimates).
export type TreeSpecies = {
  id: string;
  nameAr: string;
  nameEn: string;
  scientific: string;
  emoji: string;
  color: string;
  canopy: number; // mature canopy diameter (m)
  height: number; // mature height (m)
  spacing: number; // recommended planting spacing (m)
  co2: number; // CO2 sequestration kg/year at maturity
  pollutionFactor: number; // relative pollutant capture efficiency (1 = average broadleaf)
  coolingFactor: number; // relative evapotranspiration/shade cooling
  waterLday: number; // irrigation need, litres/day (mature, hot season avg)
  maturity: number; // years to reach mature canopy
  tMin: number; // suitable annual mean temperature range (°C)
  tMax: number;
  drought: number; // 1 (low) .. 5 (very high)
  minRain: number; // mm/year without irrigation stress
  evergreen: boolean;
  benefitsAr: string;
};

export const TREES: TreeSpecies[] = [
  { id: "neem", nameAr: "النيم", nameEn: "Neem", scientific: "Azadirachta indica", emoji: "🌳", color: "#22c55e", canopy: 10, height: 15, spacing: 8, co2: 34, pollutionFactor: 1.15, coolingFactor: 1.2, waterLday: 40, maturity: 10, tMin: 19, tMax: 33, drought: 4, minRain: 150, evergreen: true, benefitsAr: "سريعة النمو، ظل كثيف، تتحمل الحرارة والجفاف، وطاردة طبيعية للحشرات." },
  { id: "ghaf", nameAr: "الغاف", nameEn: "Ghaf", scientific: "Prosopis cineraria", emoji: "🌲", color: "#84cc16", canopy: 8, height: 10, spacing: 8, co2: 22, pollutionFactor: 0.9, coolingFactor: 1.0, waterLday: 12, maturity: 12, tMin: 20, tMax: 34, drought: 5, minRain: 80, evergreen: true, benefitsAr: "شجرة صحراوية أصيلة، جذور عميقة جداً، تثبت التربة وتكافح التصحر." },
  { id: "sidr", nameAr: "السدر", nameEn: "Christ's thorn jujube", scientific: "Ziziphus spina-christi", emoji: "🌳", color: "#65a30d", canopy: 7, height: 10, spacing: 7, co2: 24, pollutionFactor: 1.0, coolingFactor: 1.0, waterLday: 15, maturity: 10, tMin: 18, tMax: 33, drought: 5, minRain: 100, evergreen: true, benefitsAr: "تتحمل الملوحة والجفاف، مصدر لعسل السدر، ظل جيد." },
  { id: "acacia", nameAr: "السمر (الأكاسيا)", nameEn: "Umbrella thorn acacia", scientific: "Vachellia tortilis", emoji: "🌳", color: "#a3e635", canopy: 7, height: 8, spacing: 8, co2: 18, pollutionFactor: 0.8, coolingFactor: 0.85, waterLday: 8, maturity: 12, tMin: 19, tMax: 35, drought: 5, minRain: 50, evergreen: false, benefitsAr: "مقاومة استثنائية للجفاف، تثبت النيتروجين في التربة." },
  { id: "date", nameAr: "نخلة التمر", nameEn: "Date palm", scientific: "Phoenix dactylifera", emoji: "🌴", color: "#eab308", canopy: 6, height: 18, spacing: 8, co2: 16, pollutionFactor: 0.6, coolingFactor: 0.7, waterLday: 80, maturity: 8, tMin: 18, tMax: 33, drought: 4, minRain: 100, evergreen: true, benefitsAr: "إنتاج التمور، رمز تراثي، تتحمل الحرارة العالية والملوحة." },
  { id: "olive", nameAr: "الزيتون", nameEn: "Olive", scientific: "Olea europaea", emoji: "🫒", color: "#4d7c0f", canopy: 6, height: 8, spacing: 7, co2: 20, pollutionFactor: 0.95, coolingFactor: 0.85, waterLday: 25, maturity: 15, tMin: 12, tMax: 22, drought: 4, minRain: 300, evergreen: true, benefitsAr: "معمرة لمئات السنين، إنتاج الزيتون والزيت، أوراق دائمة الخضرة." },
  { id: "poinciana", nameAr: "البونسيانا الملكية", nameEn: "Royal poinciana", scientific: "Delonix regia", emoji: "🌺", color: "#f97316", canopy: 12, height: 12, spacing: 10, co2: 30, pollutionFactor: 1.05, coolingFactor: 1.3, waterLday: 50, maturity: 8, tMin: 20, tMax: 30, drought: 3, minRain: 500, evergreen: false, benefitsAr: "مظلة واسعة جداً للتظليل، أزهار حمراء زاهية تجميلية." },
  { id: "eucalyptus", nameAr: "الكافور", nameEn: "River red gum", scientific: "Eucalyptus camaldulensis", emoji: "🌲", color: "#14b8a6", canopy: 10, height: 25, spacing: 6, co2: 48, pollutionFactor: 1.1, coolingFactor: 1.1, waterLday: 90, maturity: 8, tMin: 12, tMax: 28, drought: 4, minRain: 250, evergreen: true, benefitsAr: "نمو سريع جداً، امتصاص عالٍ للكربون، لكنه يستهلك مياهاً كثيرة." },
  { id: "oak", nameAr: "البلوط", nameEn: "English oak", scientific: "Quercus robur", emoji: "🌳", color: "#16a34a", canopy: 15, height: 25, spacing: 12, co2: 48, pollutionFactor: 1.3, coolingFactor: 1.35, waterLday: 60, maturity: 25, tMin: 5, tMax: 15, drought: 2, minRain: 500, evergreen: false, benefitsAr: "تنوع حيوي هائل، مظلة ضخمة، من أعلى الأشجار في التقاط الملوثات." },
  { id: "maple", nameAr: "القيقب", nameEn: "Norway maple", scientific: "Acer platanoides", emoji: "🍁", color: "#dc2626", canopy: 12, height: 20, spacing: 10, co2: 38, pollutionFactor: 1.2, coolingFactor: 1.25, waterLday: 55, maturity: 20, tMin: 4, tMax: 14, drought: 2, minRain: 500, evergreen: false, benefitsAr: "شجرة شوارع ممتازة في المناخ البارد، ألوان خريفية خلابة." },
  { id: "pine", nameAr: "الصنوبر", nameEn: "Aleppo pine", scientific: "Pinus halepensis", emoji: "🌲", color: "#15803d", canopy: 8, height: 20, spacing: 7, co2: 30, pollutionFactor: 1.4, coolingFactor: 0.95, waterLday: 30, maturity: 15, tMin: 10, tMax: 21, drought: 4, minRain: 250, evergreen: true, benefitsAr: "الإبر تلتقط الجسيمات الدقيقة بكفاءة عالية طوال العام." },
  { id: "cedar", nameAr: "الأرز", nameEn: "Cedar of Lebanon", scientific: "Cedrus libani", emoji: "🌲", color: "#166534", canopy: 12, height: 30, spacing: 10, co2: 40, pollutionFactor: 1.35, coolingFactor: 1.1, waterLday: 45, maturity: 30, tMin: 5, tMax: 16, drought: 3, minRain: 400, evergreen: true, benefitsAr: "شجرة معمرة مهيبة، دائمة الخضرة، فعالة في التقاط الغبار." },
  { id: "jacaranda", nameAr: "الجاكاراندا", nameEn: "Jacaranda", scientific: "Jacaranda mimosifolia", emoji: "💜", color: "#a855f7", canopy: 10, height: 15, spacing: 9, co2: 26, pollutionFactor: 1.0, coolingFactor: 1.15, waterLday: 45, maturity: 10, tMin: 15, tMax: 26, drought: 3, minRain: 400, evergreen: false, benefitsAr: "أزهار بنفسجية ساحرة، مناسبة للحدائق والشوارع العريضة." },
  { id: "mango", nameAr: "المانجو", nameEn: "Mango", scientific: "Mangifera indica", emoji: "🥭", color: "#f59e0b", canopy: 10, height: 15, spacing: 10, co2: 32, pollutionFactor: 1.05, coolingFactor: 1.2, waterLday: 70, maturity: 8, tMin: 22, tMax: 30, drought: 2, minRain: 750, evergreen: true, benefitsAr: "إنتاج ثمار المانجو، مظلة كثيفة دائمة الخضرة." },
  { id: "citrus", nameAr: "الحمضيات (ليمون/برتقال)", nameEn: "Citrus", scientific: "Citrus spp.", emoji: "🍋", color: "#facc15", canopy: 4, height: 5, spacing: 5, co2: 10, pollutionFactor: 0.8, coolingFactor: 0.7, waterLday: 45, maturity: 6, tMin: 15, tMax: 28, drought: 2, minRain: 600, evergreen: true, benefitsAr: "إنتاج الثمار، حجم صغير مناسب للحدائق المنزلية." },
];

export const treeById = (id: string) => TREES.find((t) => t.id === id) || null;

export type Climate = { meanTemp: number; maxTemp: number; minTemp: number; hottestMonthMax: number; rain: number; year: number };

/** Climate suitability score 0–100 with Arabic reasons. */
export function suitability(t: TreeSpecies, c: Climate | null): { score: number; reasons: string[] } {
  if (!c) return { score: 70, reasons: ["بيانات المناخ غير متوفرة"] };
  let score = 100;
  const reasons: string[] = [];
  if (c.meanTemp < t.tMin) {
    score -= (t.tMin - c.meanTemp) * 9;
    reasons.push(`المناخ أبرد من المناسب (${c.meanTemp.toFixed(1)}°C < ${t.tMin}°C)`);
  } else if (c.meanTemp > t.tMax) {
    score -= (c.meanTemp - t.tMax) * 9;
    reasons.push(`المناخ أحر من المناسب (${c.meanTemp.toFixed(1)}°C > ${t.tMax}°C)`);
  } else reasons.push("درجة الحرارة السنوية ضمن النطاق المثالي");
  if (c.rain < t.minRain) {
    const deficit = (t.minRain - c.rain) / Math.max(t.minRain, 1);
    score -= deficit * (6 - t.drought) * 9;
    reasons.push(t.drought >= 4 ? "الأمطار قليلة لكنها تتحمل الجفاف" : "تحتاج ري منتظم بسبب قلة الأمطار");
  } else reasons.push("الأمطار كافية");
  if (c.hottestMonthMax > 42 && t.drought < 4) {
    score -= 12;
    reasons.push("الصيف شديد الحرارة عليها");
  }
  if (c.minTemp < -5 && t.tMin > 15) {
    score -= 25;
    reasons.push("معرضة لضرر الصقيع");
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

export const LAND_CLASSES = [
  { id: 0, ar: "ظل / غير محدد", color: "#334155", plantable: false },
  { id: 1, ar: "مبانٍ وبيوت", color: "#ef4444", plantable: false },
  { id: 2, ar: "شوارع وطرق", color: "#71717a", plantable: false },
  { id: 3, ar: "أسطح مرصوفة", color: "#a1a1aa", plantable: false },
  { id: 4, ar: "مياه", color: "#3b82f6", plantable: false },
  { id: 5, ar: "أشجار قائمة", color: "#15803d", plantable: false },
  { id: 6, ar: "عشب / نباتات منخفضة", color: "#86efac", plantable: true },
  { id: 7, ar: "تربة مكشوفة", color: "#d97706", plantable: true },
  { id: 8, ar: "مواقف سيارات", color: "#6b7280", plantable: false },
  { id: 9, ar: "سكك حديدية", color: "#7c3aed", plantable: false },
  { id: 10, ar: "ملاعب رياضية", color: "#06b6d4", plantable: false },
  { id: 11, ar: "طريق ترابي", color: "#92400e", plantable: false },
] as const;
