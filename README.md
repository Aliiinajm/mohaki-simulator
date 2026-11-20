# محاكي نبض — Nabd Simulator

منصة محاكاة علمية: محاكي التفاعلات الكيميائية + مستكشف المركبات ثلاثي الأبعاد + الجدول الدوري، وقسم «الذكاء الصناعي في الزراعة» (محجوز).

## Project Structure
```
src/
├─ app/
│  ├─ page.tsx                 # الصفحة الرئيسية
│  ├─ chemistry/page.tsx       # السكشن الأول (تبويبات: تفاعلات / مستكشف / جدول دوري)
│  ├─ agriculture/page.tsx     # السكشن الثاني (فارغ حالياً)
│  └─ api/chem/
│     ├─ search/route.ts       # اقتراحات فورية (PubChem autocomplete + قاموس عربي)
│     ├─ compound/route.ts     # جلب وتوحيد المركب (Cache → PubChem → CACTUS → ChemSpider)
│     ├─ sdf/route.ts          # نموذج 3D (PubChem SDF)
│     ├─ react/route.ts        # محرك التفاعل (POST)
│     ├─ periodic/route.ts     # الجدول الدوري
│     └─ stats/route.ts        # إحصائيات الذاكرة المؤقتة
├─ lib/chem/
│  ├─ sources.ts   # PubChem PUG REST/PUG View, NCI CACTUS, ChemSpider (RSC)
│  ├─ http.ts      # Timeout + Rate limiter (5 req/s) + Postgres cache
│  ├─ elements.ts  # الكتل الذرية + محلل الصيغ
│  ├─ balance.ts   # موازنة المعادلات (فضاء صفري بكسور دقيقة BigInt)
│  ├─ species.ts   # الأيونات، قواعد الذوبانية، سلسلة النشاط، ΔHf°
│  ├─ rules.ts     # قواعد التفاعلات + شروط الحرارة/الحفاز/الإشعال
│  ├─ organic.ts   # تحويلات عضوية بـ OpenChemLib (أسترة، هدرجة، إضافة، استبدال)
│  ├─ ibmRxn.ts    # IBM RXN (Async polling)
│  └─ engine.ts    # التنسيق + Stoichiometry + Cache
├─ components/chem/ # CompoundSearch (debounce 300ms), MoleculeView (OCL), Molecule3D (3Dmol), ChemEquation (KaTeX/mhchem) ...
└─ db/schema.ts     # compounds, reactions, api_cache
```

## Architecture note
The spec suggested FastAPI + SQLite; this implementation runs the same pipeline inside Next.js Route Handlers (server-side proxy: no CORS, keys stay on the server) with PostgreSQL (Drizzle) as the cache layer.

## Environment

| Variable | Required | Used for | If missing |
|---|---|---|---|
| `DATABASE_URL` | No | Cache for compounds/reactions, saved map analyses, stats counters | App runs; lookups go straight to PubChem/CACTUS, nothing is cached |
| `CHEMSPIDER_API_KEY` | No | ChemSpider (RSC) enrichment | Source marked `skipped` in the compound card |
| `IBM_RXN_API_KEY` | No | AI prediction of complex organic reactions | Rule engine still answers; a note is shown instead |
| `IBM_RXN_PROJECT_ID` | No | Reuse an existing RXN project | A project is created automatically on first use |
| `IBM_RXN_BASE_URL` | No | Override the RXN endpoint | Defaults to `https://rxn.app.accelerate.science` |

No key is needed for PubChem, NCI CACTUS, Esri imagery, OpenStreetMap, Nominatim or Open-Meteo.

## Local setup (Windows / VS Code)

```powershell
Copy-Item .env.example .env      # then edit DATABASE_URL
npm install
psql -U postgres -c "CREATE DATABASE app_db;"   # only once
npx drizzle-kit push                            # creates the tables
npm run dev -- -H 0.0.0.0 -p 8080               # reachable on the LAN
```

`-H 0.0.0.0` is required to open the dev server on `http://10.162.197.167:8080`;
without it Next.js binds to `localhost` only. `next.config.ts` already lists the
dev origins for `localhost:3000`, `:8080` and `10.162.197.167:8080`.

### Diagnosing problems

Open **`/api/health`** first. It reports whether `DATABASE_URL` is set, whether
PostgreSQL is reachable (with host/port/database and the masked URL), whether
the tables exist, and which optional keys are configured — plus the exact fix
for each failure. Every API route returns a JSON body with an `error` field
(and a `hint` where useful) instead of failing silently.
