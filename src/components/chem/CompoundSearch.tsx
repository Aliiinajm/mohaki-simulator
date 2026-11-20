"use client";
import { useEffect, useRef, useState } from "react";
import type { CompoundData } from "@/lib/chem/sources";

type Suggestion = { label: string; value: string; source: string };

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CompoundSearch({
  value,
  onChange,
  onResolved,
  placeholder = "اكتب اسم مركب أو عنصر (عربي/إنجليزي)...",
  label,
  accent = "cyan",
  autoResolve,
}: {
  value: string;
  onChange: (v: string) => void;
  onResolved: (d: CompoundData | null, error?: string) => void;
  placeholder?: string;
  label?: string;
  accent?: "cyan" | "emerald";
  autoResolve?: number; // change this number to trigger resolve of current value
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loadingSug, setLoadingSug] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounced = useDebounced(value, 300);
  const skipNext = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced autocomplete (300ms)
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = debounced.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingSug(true);
    fetch(`/api/chem/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        setSuggestions(j.suggestions || []);
        setActive(-1);
        setOpen(document.activeElement === inputRef.current);
      })
      .catch(() => {})
      .finally(() => setLoadingSug(false));
  }, [debounced]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function resolve(name: string) {
    if (!name.trim()) return;
    setOpen(false);
    setResolving(true);
    try {
      const r = await fetch(`/api/chem/compound?q=${encodeURIComponent(name.trim())}`);
      const text = await r.text();
      const j = text ? JSON.parse(text) : {};
      if (r.ok) onResolved(j as CompoundData);
      else if (r.status === 404) onResolved(null, j.error || `لم يتم العثور على "${name.trim()}" في قواعد البيانات`);
      else if (r.status === 400) onResolved(null, j.error || "طلب غير صالح");
      else onResolved(null, j.error || `خطأ في الخادم (${r.status}) — تحقق من /api/health`);
    } catch {
      onResolved(null, "تعذر الاتصال بالخادم — تأكد من تشغيله ومن اتصال الإنترنت");
    } finally {
      setResolving(false);
    }
  }

  useEffect(() => {
    if (autoResolve) resolve(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResolve]);

  function pick(s: Suggestion) {
    skipNext.current = true;
    onChange(s.value);
    setSuggestions([]);
    resolve(s.value);
  }

  const ring = accent === "cyan" ? "focus-within:border-cyan-400/60 focus-within:shadow-cyan-500/20" : "focus-within:border-emerald-400/60 focus-within:shadow-emerald-500/20";

  return (
    <div ref={boxRef} className="relative">
      {label && <label className="mb-2 block text-sm font-semibold text-slate-300">{label}</label>}
      <div className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a1630] px-4 py-3 shadow-lg transition ${ring}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (active >= 0 && suggestions[active]) pick(suggestions[active]);
              else resolve(value);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {(loadingSug || resolving) && <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />}
        {!resolving && value && (
          <button onClick={() => resolve(value)} className="shrink-0 rounded-lg bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25">
            جلب
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="fade-up absolute z-40 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-cyan-400/20 bg-[#0b1833]/95 p-1 shadow-2xl backdrop-blur-xl">
          {suggestions.map((s, i) => (
            <li key={s.label + i}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition ${i === active ? "bg-cyan-400/15 text-white" : "text-slate-200"}`}
              >
                <span className="truncate">{s.label}</span>
                <span className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-cyan-200/70">{s.source}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
