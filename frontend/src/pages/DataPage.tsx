import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { getPreview, getFullProfile } from "@/lib/api";
import { ColumnProfile } from "@/types";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import clsx from "clsx";

const COL_COLORS = [
  { accent: "var(--acid)",   bg: "rgba(223,255,0,0.06)",  b: "rgba(223,255,0,0.2)",  bar: "#DFFF00",  badge: "badge-acid" },
  { accent: "var(--cyan)",   bg: "rgba(0,255,255,0.06)",  b: "rgba(0,255,255,0.2)",  bar: "#00FFFF",  badge: "badge-cyan" },
  { accent: "var(--plasma)", bg: "rgba(191,90,242,0.06)", b: "rgba(191,90,242,0.2)", bar: "#BF5AF2",  badge: "badge-plasma" },
  { accent: "var(--ember)",  bg: "rgba(255,107,53,0.06)", b: "rgba(255,107,53,0.2)", bar: "#FF6B35",  badge: "badge-ember" },
];

function MiniHist({ hist, color }: { hist: { x: number; count: number }[]; color: string }) {
  const max = Math.max(...hist.map(h => h.count), 1);
  return (
    <div className="flex items-end gap-px h-10 mt-2">
      {hist.map((b, i) => (
        <div key={i} className="flex-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          style={{ height: `${(b.count/max)*100}%`, minHeight: 2, background: color }}
          title={`${b.x.toFixed(2)}: ${b.count}`} />
      ))}
    </div>
  );
}

function ColCard({ col, idx }: { col: ColumnProfile; idx: number }) {
  const c = COL_COLORS[idx % COL_COLORS.length];
  const isNum = col.min !== undefined;
  return (
    <div className="card-3d glass rounded-2xl p-4 relative overflow-hidden"
      style={{ borderColor: c.b, background: `linear-gradient(135deg, rgba(5,5,5,0.9), ${c.bg})` }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="font-hero font-semibold text-sm text-white truncate" title={col.name}>{col.name}</span>
        <span className={`badge ${c.badge} shrink-0`}>{col.dtype}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          { l: "Unique",  v: col.unique.toLocaleString() },
          { l: "Nulls",   v: col.null_count.toLocaleString() },
          { l: "Null %",  v: `${col.null_pct}%` },
        ].map(s => (
          <div key={s.l} className="glass rounded-xl p-2 text-center">
            <div className="font-hero font-bold text-sm" style={{ color: c.accent }}>{s.v}</div>
            <div className="font-mono text-[9px] uppercase tracking-wide mt-0.5" style={{ color: "var(--text-3)" }}>{s.l}</div>
          </div>
        ))}
      </div>
      {col.null_pct > 0 && (
        <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: "var(--smoke)" }}>
          <div className="h-full rounded-full" style={{ width: `${col.null_pct}%`, background: "var(--ember)" }} />
        </div>
      )}
      {isNum && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
            {[["Min",col.min],["Max",col.max],["Mean",col.mean],["Median",col.median]].map(([l,v]) => (
              <div key={l as string} className="flex justify-between">
                <span style={{ color: "var(--text-3)" }}>{l}</span>
                <span className="font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—"}
                </span>
              </div>
            ))}
          </div>
          {col.hist && <MiniHist hist={col.hist} color={c.bar} />}
        </>
      )}
      {!isNum && col.top_values && (
        <div className="space-y-1.5">
          {col.top_values.slice(0,5).map(v => (
            <div key={v.value}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="truncate max-w-[130px]" style={{ color: "rgba(255,255,255,0.7)" }}>{v.value}</span>
                <span className="font-mono shrink-0 ml-1" style={{ color: "var(--text-2)" }}>{v.count.toLocaleString()}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--smoke)" }}>
                <div className="h-full rounded-full" style={{ width: `${(v.count/col.total)*100}%`, background: c.bar }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABLE_COL_COLORS = ["var(--acid)","var(--cyan)","var(--plasma)","var(--ember)","#84cc16","#3b82f6"];

function DataTable({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    columns: {name:string;dtype:string}[]; rows: Record<string,unknown>[];
    total_rows: number; total_pages: number;
  }|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPreview(id, page, 100).then(d => { setData(d); setLoading(false); });
  }, [id, page]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 rounded-full border-2 border-t-acid border-r-cyan border-b-plasma border-l-transparent animate-spin" />
    </div>
  );
  if (!data) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "var(--graphite)" }}>
              {data.columns.map((c,i) => (
                <th key={c.name} className="text-left px-3 py-3 font-hero font-semibold whitespace-nowrap border-b"
                  style={{ borderColor: "var(--smoke)", color: TABLE_COL_COLORS[i%TABLE_COL_COLORS.length] }}>
                  <span className="font-mono text-[10px] mr-1.5 opacity-50">
                    {/int|float/.test(c.dtype) ? "#" : /date/.test(c.dtype) ? "⏱" : "T"}
                  </span>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row,i) => (
              <tr key={i} className="border-b transition-colors"
                style={{
                  borderColor: "rgba(255,255,255,0.04)",
                  background: i%2===0 ? "var(--carbon)" : "var(--void)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(223,255,0,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? "var(--carbon)" : "var(--void)")}>
                {data.columns.map((c,ci) => {
                  const val = row[c.name];
                  const isNull = val === null || val === undefined;
                  return (
                    <td key={c.name} className="px-3 py-2 font-mono whitespace-nowrap max-w-[200px] truncate"
                      title={isNull ? "null" : String(val)}>
                      {isNull
                        ? <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>null</span>
                        : <span style={{ color: /int|float/.test(c.dtype) ? TABLE_COL_COLORS[ci%TABLE_COL_COLORS.length] : "rgba(255,255,255,0.65)" }}>
                            {String(val)}
                          </span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-t shrink-0"
        style={{ background: "var(--graphite)", borderColor: "var(--smoke)" }}>
        <span className="badge badge-acid font-mono">
          {data.total_rows.toLocaleString()} rows · Page {page}/{data.total_pages}
        </span>
        <div className="flex items-center gap-2">
          {[["‹", ()=>setPage(p=>Math.max(1,p-1)), page===1], ["›", ()=>setPage(p=>Math.min(data.total_pages,p+1)), page===data.total_pages]].map(([label, fn, dis]) => (
            <button key={label as string} onClick={fn as ()=>void} disabled={dis as boolean}
              className="w-8 h-8 rounded-lg glass flex items-center justify-center transition-all disabled:opacity-30 hover:border-acid/40 font-hero font-bold"
              style={{ color: "var(--text-2)" }}>
              {label as string}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DataPage() {
  const dataset = useStore(s => s.activeDataset);
  const [tab, setTab]         = useState<"table"|"profile">("table");
  const [profile, setProfile] = useState<ColumnProfile[]|null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setProfile(null); }, [dataset?.dataset_id]);
  const loadProfile = useCallback(async () => {
    if (!dataset || profile) return;
    setLoading(true);
    setProfile(await getFullProfile(dataset.dataset_id));
    setLoading(false);
  }, [dataset, profile]);
  useEffect(() => { if (tab==="profile") loadProfile(); }, [tab, loadProfile]);

  if (!dataset) return (
    <div className="flex-1 flex items-center justify-center bg-dots" style={{ background: "var(--carbon)" }}>
      <div className="text-center">
        <AlertCircle size={36} className="mx-auto mb-3" style={{ color: "var(--ash)" }} />
        <p className="font-hero font-medium" style={{ color: "var(--text-2)" }}>No dataset selected</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--void)" }}>
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0"
        style={{ background: "rgba(5,5,5,0.9)", borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        <div>
          <h1 className="font-display font-bold text-white text-sm uppercase tracking-wider">Data Explorer</h1>
          <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{dataset.filename}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-acid">{dataset.rows.toLocaleString()} rows</span>
          <span className="badge badge-cyan">{dataset.columns} cols</span>
        </div>
        <div className="flex items-center gap-1 ml-auto glass p-1 rounded-xl">
          {(["table","profile"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-1.5 rounded-lg text-xs font-hero font-semibold uppercase tracking-wider transition-all",
                tab===t ? "btn-acid" : "hover:text-white")}
              style={tab!==t ? { color: "var(--text-2)" } : {}}>
              {t==="table" ? "Table" : "Profile"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab==="table" && <DataTable id={dataset.dataset_id} />}
        {tab==="profile" && (
          <div className="h-full overflow-y-auto p-5 bg-dots" style={{ background: "var(--carbon)" }}>
            {loading
              ? <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 rounded-full border-2 border-t-acid border-r-cyan border-b-plasma border-l-transparent animate-spin" />
                </div>
              : profile && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {profile.map((col,i) => <ColCard key={col.name} col={col} idx={i} />)}
                  </div>
                )}
          </div>
        )}
      </div>
    </div>
  );
}
