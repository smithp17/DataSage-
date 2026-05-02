import { NavLink } from "react-router-dom";
import { Sparkles, Table2, Code2, LayoutDashboard, Plus, Trash2, ChevronRight, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { uploadDataset } from "@/lib/api";
import { useRef, useState, useEffect } from "react";
import clsx from "clsx";

const NAV = [
  { to: "/",          icon: Sparkles,        label: "Analyst",   accent: "acid",   glow: "rgba(223,255,0,0.15)" },
  { to: "/data",      icon: Table2,           label: "Explorer",  accent: "cyan",   glow: "rgba(0,255,255,0.15)" },
  { to: "/sql",       icon: Code2,            label: "SQL",       accent: "plasma", glow: "rgba(191,90,242,0.15)" },
  { to: "/dashboard", icon: LayoutDashboard,  label: "Dashboard", accent: "ember",  glow: "rgba(255,107,53,0.15)" },
];

const ACCENT_COLORS: Record<string, string> = {
  acid:   "var(--acid)",
  cyan:   "var(--cyan)",
  plasma: "var(--plasma)",
  ember:  "var(--ember)",
};

const MODE_STYLE: Record<string, { label: string; color: string; bg: string; border: string; tip: string }> = {
  hybrid: {
    label: "Hybrid AI",
    color: "var(--acid)",
    bg:    "rgba(223,255,0,0.1)",
    border:"rgba(223,255,0,0.3)",
    tip:   "Groq fetches data · Gemini builds charts",
  },
  gemini: {
    label: "Gemini",
    color: "var(--cyan)",
    bg:    "rgba(0,255,255,0.1)",
    border:"rgba(0,255,255,0.3)",
    tip:   "Gemini 2.0 Flash",
  },
  groq: {
    label: "Groq",
    color: "var(--plasma)",
    bg:    "rgba(191,90,242,0.1)",
    border:"rgba(191,90,242,0.3)",
    tip:   "Llama 3.1 via Groq",
  },
  none: {
    label: "No AI",
    color: "var(--ember)",
    bg:    "rgba(255,107,53,0.1)",
    border:"rgba(255,107,53,0.3)",
    tip:   "Add API keys in backend/.env",
  },
};

function AIStatusBadge() {
  const [mode, setMode] = useState<string>("groq");
  const [tip,  setTip]  = useState(false);

  useEffect(() => {
    fetch("/api/ai/status")
      .then(r => r.json())
      .then(d => setMode(d.mode))
      .catch(() => {});
  }, []);

  const s = MODE_STYLE[mode] ?? MODE_STYLE.groq;
  return (
    <div className="relative">
      <button
        onClick={() => setTip(v => !v)}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-all"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}>
        <div className="pulse-dot w-1.5 h-1.5 shrink-0" style={{ background: s.color }} />
        <span className="font-hero font-semibold text-[11px] uppercase tracking-wider" style={{ color: s.color }}>
          {s.label}
        </span>
      </button>
      {tip && (
        <div className="absolute bottom-full left-0 mb-2 w-48 glass rounded-xl p-3 text-[11px]"
          style={{ color: "var(--text-2)", zIndex: 100 }}>
          <p className="font-hero font-semibold mb-1" style={{ color: s.color }}>{s.label} mode</p>
          <p className="font-mono leading-relaxed">{s.tip}</p>
          {mode === "groq" && (
            <p className="mt-1.5 font-mono" style={{ color: "var(--text-3)" }}>
              Add GEMINI_API_KEY to enable Hybrid
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SideNav() {
  const { datasets, activeDataset, addDataset, removeDataset, setActive, savedCharts } = useStore();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { addDataset(await uploadDataset(file)); }
    catch { /* ignore */ }
    finally { setUploading(false); e.target.value = ""; }
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen relative z-20"
      style={{
        background: "rgba(5,5,5,0.9)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>

      {/* ── Logo ── */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 glow-acid"
            style={{ background: "var(--acid)" }}>
            <Zap size={18} color="#000" fill="#000" />
          </div>
          <div>
            <div className="font-display text-white font-bold text-sm tracking-wider uppercase">DataSage</div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
              AI Analytics
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="px-3 py-4 flex flex-col gap-1">
        {NAV.map(({ to, icon: Icon, label, accent, glow }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className="block rounded-xl overflow-hidden transition-all duration-200">
            {({ isActive }) => (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background:  isActive ? glow : "transparent",
                  border:      `1px solid ${isActive ? ACCENT_COLORS[accent] + "40" : "transparent"}`,
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: isActive ? ACCENT_COLORS[accent] : "var(--smoke)",
                    boxShadow:  isActive ? `0 0 12px ${ACCENT_COLORS[accent]}60` : "none",
                  }}>
                  <Icon size={13} style={{ color: isActive ? "#000" : "var(--text-2)" }} />
                </div>
                <span className="text-sm font-medium font-hero transition-colors"
                  style={{ color: isActive ? ACCENT_COLORS[accent] : "var(--text-2)" }}>
                  {label}
                </span>
                {label === "Dashboard" && savedCharts.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--ember)", color: "#000" }}>
                    {savedCharts.length}
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* ── Datasets ── */}
      <div className="flex-1 overflow-hidden flex flex-col px-3 py-3">
        <div className="flex items-center justify-between px-1 mb-3">
          <button onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 font-hero text-[10px] font-semibold uppercase tracking-widest transition-colors hover:text-white"
            style={{ color: "var(--text-3)" }}>
            <ChevronRight size={10} className={clsx("transition-transform", open && "rotate-90")} />
            Datasets
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="p-1.5 rounded-lg transition-all hover:bg-acid/10 hover:text-acid"
            style={{ color: "var(--text-3)" }}>
            {uploading
              ? <div className="w-3 h-3 border border-acid border-t-transparent rounded-full animate-spin" />
              : <Plus size={13} />}
          </button>
          <input ref={fileRef} type="file" className="hidden"
            accept=".csv,.xlsx,.xls,.json,.parquet" onChange={handleFile} />
        </div>

        {open && (
          <div className="flex flex-col gap-1 overflow-y-auto">
            {datasets.length === 0 && (
              <button onClick={() => fileRef.current?.click()}
                className="py-5 rounded-xl border border-dashed text-xs text-center transition-all font-hero"
                style={{ borderColor: "var(--smoke)", color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(223,255,0,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--smoke)")}>
                <Plus size={14} className="mx-auto mb-1 opacity-40" />
                Upload dataset
              </button>
            )}

            {datasets.map((d, i) => {
              const isActive = activeDataset?.dataset_id === d.dataset_id;
              const colors = [
                { c: "var(--acid)",   bg: "rgba(223,255,0,0.08)",  b: "rgba(223,255,0,0.25)" },
                { c: "var(--cyan)",   bg: "rgba(0,255,255,0.08)",  b: "rgba(0,255,255,0.25)" },
                { c: "var(--plasma)", bg: "rgba(191,90,242,0.08)", b: "rgba(191,90,242,0.25)" },
                { c: "var(--ember)",  bg: "rgba(255,107,53,0.08)", b: "rgba(255,107,53,0.25)" },
              ];
              const col = colors[i % colors.length];
              return (
                <div key={d.dataset_id} onClick={() => setActive(d)}
                  className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: isActive ? col.bg : "transparent",
                    border: `1px solid ${isActive ? col.b : "transparent"}`,
                  }}
                  onMouseEnter={e => !isActive && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 pulse-dot"
                    style={{ background: isActive ? col.c : "var(--ash)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium font-hero truncate"
                      style={{ color: isActive ? col.c : "var(--text-2)" }}>
                      {d.filename}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
                      {d.rows.toLocaleString()}r · {d.columns}c
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeDataset(d.dataset_id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all hover:text-ember"
                    style={{ color: "var(--text-3)" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <AIStatusBadge />
        <div className="flex items-center gap-2 mt-1.5">
          <div className="pulse-dot w-1.5 h-1.5" style={{ background: "var(--acid)" }} />
          <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
            DataSage v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
