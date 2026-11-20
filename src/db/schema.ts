import { pgTable, serial, bigint, text, doublePrecision, integer, jsonb, timestamp, foreignKey } from "drizzle-orm/pg-core";

/** Normalized compound cache (PubChem → CACTUS → ChemSpider). */
export const compounds = pgTable("compounds", {
  id: serial("id").primaryKey(),
  queryKey: text("query_key").notNull().unique(),
  cid: integer("cid"),
  name: text("name").notNull(),
  smiles: text("smiles"),
  formula: text("formula"),
  molecularWeight: doublePrecision("molecular_weight"),
  source: text("source").notNull(),
  data: jsonb("data").notNull(),
  hits: integer("hits").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Reaction cache keyed by SMILES1 + SMILES2 + conditions. */
export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  status: text("status").notNull(),
  equation: text("equation"),
  result: jsonb("result").notNull(),
  hits: integer("hits").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Generic key/value cache for autocomplete, SDF, periodic table, etc. */
export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** AI land-cover analyses for the agriculture section. */
export const agriAnalyses = pgTable("agri_analyses", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  bbox: jsonb("bbox").notNull(),
  grid: text("grid").notNull(),
  meta: jsonb("meta").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Tree planting plans generated for an analysis. */
export const agriPlans = pgTable("agri_plans", {
  id: serial("id").primaryKey(),
  analysisId: bigint("analysis_id", { mode: "number" }).notNull(),
  species: text("species").notNull(),
  trees: integer("trees").notNull(),
  stats: jsonb("stats").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  fkAnalysis: foreignKey({
    columns: [table.analysisId],
    foreignColumns: [agriAnalyses.id],
  }),
}));