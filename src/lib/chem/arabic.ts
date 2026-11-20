// Arabic → English common names for search & autocomplete.
export const ARABIC_NAMES: [string, string][] = [
  ["ماء", "water"],
  ["هيدروجين", "hydrogen"],
  ["أكسجين", "oxygen"],
  ["اكسجين", "oxygen"],
  ["نيتروجين", "nitrogen"],
  ["كربون", "carbon"],
  ["كبريت", "sulfur"],
  ["فوسفور", "phosphorus"],
  ["كلور", "chlorine"],
  ["بروم", "bromine"],
  ["يود", "iodine"],
  ["فلور", "fluorine"],
  ["هيليوم", "helium"],
  ["نيون", "neon"],
  ["أرجون", "argon"],
  ["صوديوم", "sodium"],
  ["بوتاسيوم", "potassium"],
  ["ليثيوم", "lithium"],
  ["مغنيسيوم", "magnesium"],
  ["كالسيوم", "calcium"],
  ["باريوم", "barium"],
  ["ألومنيوم", "aluminum"],
  ["الومنيوم", "aluminum"],
  ["حديد", "iron"],
  ["نحاس", "copper"],
  ["خارصين", "zinc"],
  ["زنك", "zinc"],
  ["فضة", "silver"],
  ["ذهب", "gold"],
  ["بلاتين", "platinum"],
  ["رصاص", "lead"],
  ["قصدير", "tin"],
  ["زئبق", "mercury"],
  ["نيكل", "nickel"],
  ["يورانيوم", "uranium"],
  ["سيليكون", "silicon"],
  ["ملح الطعام", "sodium chloride"],
  ["كلوريد الصوديوم", "sodium chloride"],
  ["هيدروكسيد الصوديوم", "sodium hydroxide"],
  ["الصودا الكاوية", "sodium hydroxide"],
  ["هيدروكسيد البوتاسيوم", "potassium hydroxide"],
  ["هيدروكسيد الكالسيوم", "calcium hydroxide"],
  ["حمض الهيدروكلوريك", "hydrochloric acid"],
  ["حمض الكلوريدريك", "hydrochloric acid"],
  ["حمض الكبريتيك", "sulfuric acid"],
  ["حمض النيتريك", "nitric acid"],
  ["حمض الفوسفوريك", "phosphoric acid"],
  ["حمض الخليك", "acetic acid"],
  ["خل", "acetic acid"],
  ["حمض الكربونيك", "carbonic acid"],
  ["حمض الستريك", "citric acid"],
  ["ثاني أكسيد الكربون", "carbon dioxide"],
  ["ثاني اكسيد الكربون", "carbon dioxide"],
  ["أول أكسيد الكربون", "carbon monoxide"],
  ["ثاني أكسيد الكبريت", "sulfur dioxide"],
  ["ثالث أكسيد الكبريت", "sulfur trioxide"],
  ["أمونيا", "ammonia"],
  ["امونيا", "ammonia"],
  ["نشادر", "ammonia"],
  ["كلوريد الأمونيوم", "ammonium chloride"],
  ["ميثان", "methane"],
  ["إيثان", "ethane"],
  ["ايثان", "ethane"],
  ["بروبان", "propane"],
  ["بيوتان", "butane"],
  ["أوكتان", "octane"],
  ["إيثيلين", "ethylene"],
  ["ايثيلين", "ethylene"],
  ["أسيتيلين", "acetylene"],
  ["بنزين", "benzene"],
  ["إيثانول", "ethanol"],
  ["ايثانول", "ethanol"],
  ["كحول", "ethanol"],
  ["ميثانول", "methanol"],
  ["جلوكوز", "glucose"],
  ["سكر", "sucrose"],
  ["أسبرين", "aspirin"],
  ["اسبرين", "aspirin"],
  ["كافيين", "caffeine"],
  ["باراسيتامول", "paracetamol"],
  ["أسيتون", "acetone"],
  ["فورمالديهايد", "formaldehyde"],
  ["كربونات الكالسيوم", "calcium carbonate"],
  ["حجر جيري", "calcium carbonate"],
  ["أكسيد الكالسيوم", "calcium oxide"],
  ["جير حي", "calcium oxide"],
  ["بيكربونات الصوديوم", "sodium bicarbonate"],
  ["كربونات الصوديوم", "sodium carbonate"],
  ["نترات الفضة", "silver nitrate"],
  ["كبريتات النحاس", "copper(II) sulfate"],
  ["كلوريد الباريوم", "barium chloride"],
  ["كبريتات الصوديوم", "sodium sulfate"],
  ["بروميد الصوديوم", "sodium bromide"],
  ["يوديد البوتاسيوم", "potassium iodide"],
  ["نترات الرصاص", "lead(II) nitrate"],
  ["أكسيد المغنيسيوم", "magnesium oxide"],
  ["أكسيد الحديد", "iron(III) oxide"],
  ["صدأ", "iron(III) oxide"],
  ["بيروكسيد الهيدروجين", "hydrogen peroxide"],
  ["ماء أكسجيني", "hydrogen peroxide"],
  ["يوريا", "urea"],
  ["نيكوتين", "nicotine"],
  ["كوليسترول", "cholesterol"],
  ["دوبامين", "dopamine"],
  ["أدرينالين", "adrenaline"],
];

const normalize = (s: string) =>
  s
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "")
    .replace(/\s+/g, " ");

export const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

/** Find exact English name for an Arabic query. */
export function arabicToEnglish(q: string): string | null {
  const nq = normalize(q);
  for (const [ar, en] of ARABIC_NAMES) if (normalize(ar) === nq) return en;
  return null;
}

/** Suggestions for partial Arabic input. */
export function arabicSuggestions(q: string, limit = 8): { label: string; value: string }[] {
  const nq = normalize(q);
  if (!nq) return [];
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const [ar, en] of ARABIC_NAMES) {
    const na = normalize(ar);
    if (na.startsWith(nq) || na.includes(nq)) {
      if (seen.has(en)) continue;
      seen.add(en);
      out.push({ label: `${ar} — ${en}`, value: en });
      if (out.length >= limit) break;
    }
  }
  return out;
}
