import { useState, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { runSQL } from "@/lib/api";
import { SQLResult } from "@/types";
import { Play, Copy, Download, AlertCircle, CheckCircle2, Clock, Code2 } from "lucide-react";

const EXAMPLES = [
  { label: "Count rows",    sql: "SELECT COUNT(*) AS total FROM df",             badge: "badge-acid" },
  { label: "First 10",      sql: "SELECT * FROM df LIMIT 10",                    badge: "badge-cyan" },
  { label: "Group & count", sql: "SELECT col, COUNT(*) AS cnt\nFROM df\nGROUP BY col\nORDER BY cnt DESC\nLIMIT 20", badge: "badge-plasma" },
  { label: "Filter rows",   sql: "SELECT * FROM df WHERE col > 100 LIMIT 50",    badge: "badge-ember" },
  { label: "Top by sum",    sql: "SELECT name_col, SUM(value_col) AS total\nFROM df\nGROUP BY name_col\nORDER BY total DESC\nLIMIT 10", badge: "badge-acid" },
  { label: "Avg by group",  sql: "SELECT category, AVG(metric) AS avg\nFROM df\nGROUP BY category\nORDER BY avg DESC", badge: "badge-cyan" },
];

const COL_C = ["var(--acid)","var(--cyan)","var(--plasma)","var(--ember)","#84cc16","#3b82f6"];

function ResultTable({ result }: { result: SQLResult }) {
  const dl = useCallback(() => {
    const h = result.columns.map(c=>c.name).join(",");
    const r = result.rows.map(row=>result.columns.map(c=>JSON.stringify(row[c.name]??""  )).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[h,...r].join("\n")],{type:"text/csv"}));
    a.download = "result.csv"; a.click();
  }, [result]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ background: "var(--graphite)", borderColor: "var(--smoke)" }}>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={14} style={{ color: "var(--acid)" }} />
          <span className="badge badge-acid font-mono">{result.row_count.toLocaleString()} rows</span>
          {result.truncated && <span className="badge badge-ember">first 2,000 shown</span>}
        </div>
        <button onClick={dl} className="btn-ghost text-xs py-1.5 px-3">
          <Download size={12} /> Export CSV
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "var(--graphite)" }}>
              {result.columns.map((c,i) => (
                <th key={c.name} className="text-left px-3 py-3 font-hero font-semibold whitespace-nowrap border-b"
                  style={{ borderColor: "var(--smoke)", color: COL_C[i%COL_C.length] }}>
                  {c.name}
                  <span className="font-mono text-[9px] ml-1 opacity-40">{c.dtype.slice(0,5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row,i) => (
              <tr key={i} className="border-b"
                style={{ borderColor: "rgba(255,255,255,0.04)", background: i%2===0?"var(--carbon)":"var(--void)" }}
                onMouseEnter={e=>(e.currentTarget.style.background="rgba(223,255,0,0.03)")}
                onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?"var(--carbon)":"var(--void)")}>
                {result.columns.map((c,ci) => {
                  const val = row[c.name];
                  return (
                    <td key={c.name} className="px-3 py-2 font-mono whitespace-nowrap max-w-xs truncate">
                      {val===null
                        ? <span style={{color:"var(--text-3)",fontStyle:"italic"}}>null</span>
                        : <span style={{color:/int|float/.test(c.dtype)?COL_C[ci%COL_C.length]:"rgba(255,255,255,0.65)"}}>{String(val)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SQLPage() {
  const dataset = useStore(s => s.activeDataset);
  const [sql,    setSql]    = useState("SELECT * FROM df LIMIT 100");
  const [result, setResult] = useState<SQLResult|null>(null);
  const [error,  setError]  = useState("");
  const [running,setRunning]= useState(false);
  const [ms,     setMs]     = useState<number|null>(null);
  const t0 = useRef(0);

  const run = useCallback(async () => {
    if (!dataset||!sql.trim()||running) return;
    setRunning(true); setError(""); setResult(null); t0.current=Date.now();
    try { setResult(await runSQL(dataset.dataset_id, sql)); setMs(Date.now()-t0.current); }
    catch(e:unknown) { setError((e as{response?:{data?:{detail?:string}}})?.response?.data?.detail??"SQL error"); }
    finally { setRunning(false); }
  }, [dataset, sql, running]);

  if (!dataset) return (
    <div className="flex-1 flex items-center justify-center bg-dots" style={{background:"var(--carbon)"}}>
      <div className="text-center">
        <Code2 size={36} className="mx-auto mb-3" style={{color:"var(--ash)"}}/>
        <p className="font-hero font-medium" style={{color:"var(--text-2)"}}>No dataset selected</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{background:"var(--void)"}}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0"
        style={{background:"rgba(5,5,5,0.9)",borderColor:"rgba(255,255,255,0.06)",backdropFilter:"blur(12px)"}}>
        <div>
          <h1 className="font-display font-bold text-white text-sm uppercase tracking-wider">SQL Editor</h1>
          <p className="font-mono text-[11px] mt-0.5" style={{color:"var(--text-3)"}}>
            Query <span style={{color:"var(--plasma)"}}>df</span> · DuckDB · SELECT only
          </p>
        </div>
        {ms && !running && <span className="badge badge-acid"><Clock size={10}/> {ms}ms</span>}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="flex flex-col border-r" style={{width:"50%",borderColor:"rgba(255,255,255,0.06)"}}>
          {/* Example chips */}
          <div className="flex gap-1.5 px-4 py-3 border-b overflow-x-auto shrink-0"
            style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(5,5,5,0.8)"}}>
            {EXAMPLES.map(ex => (
              <button key={ex.label} onClick={()=>setSql(ex.sql)}
                className={`badge ${ex.badge} whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity`}>
                {ex.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="flex-1 relative min-h-0">
            <textarea value={sql} onChange={e=>setSql(e.target.value)}
              onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")run();}}
              className="w-full h-full font-mono resize-none outline-none p-5 leading-relaxed text-sm"
              style={{background:"var(--carbon)",color:"var(--cyan)",caretColor:"var(--acid)"}}
              spellCheck={false}/>
            <button onClick={()=>navigator.clipboard.writeText(sql)}
              className="absolute top-3 right-3 p-1.5 rounded-lg transition-all hover:bg-acid/10"
              style={{color:"var(--text-3)"}}>
              <Copy size={12}/>
            </button>
          </div>

          {/* Run */}
          <div className="flex items-center justify-between px-4 py-3 border-t shrink-0"
            style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(5,5,5,0.8)"}}>
            <span className="font-mono text-[10px]" style={{color:"var(--text-3)"}}>Ctrl+Enter to run</span>
            <button onClick={run} disabled={running||!sql.trim()}
              className="btn-acid disabled:opacity-40">
              {running
                ? <><div className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin"/> Running…</>
                : <><Play size={13} fill="currentColor"/> Run Query</>}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!result&&!error&&!running && (
            <div className="flex-1 flex items-center justify-center text-center p-8 bg-dots" style={{background:"var(--carbon)"}}>
              <div>
                <div className="w-16 h-16 glass-plasma rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Code2 size={28} style={{color:"var(--plasma)"}}/>
                </div>
                <p className="font-hero font-medium" style={{color:"var(--text-2)"}}>Run a query to see results</p>
                <p className="font-mono text-[11px] mt-1" style={{color:"var(--text-3)"}}>
                  Dataset available as <span style={{color:"var(--plasma)"}}>df</span>
                </p>
              </div>
            </div>
          )}
          {running && (
            <div className="flex-1 flex items-center justify-center" style={{background:"var(--carbon)"}}>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-2 border-t-acid border-r-cyan border-b-plasma border-l-transparent animate-spin mx-auto mb-3"/>
                <p className="font-hero text-sm" style={{color:"var(--text-2)"}}>Executing query…</p>
              </div>
            </div>
          )}
          {error && (
            <div className="m-5 flex items-start gap-3 glass-acid rounded-xl p-4">
              <AlertCircle size={16} style={{color:"var(--ember)"}} className="shrink-0 mt-0.5"/>
              <div>
                <p className="font-hero font-semibold text-sm mb-1" style={{color:"var(--ember)"}}>Query Error</p>
                <pre className="font-mono text-xs whitespace-pre-wrap" style={{color:"rgba(255,107,53,0.8)"}}>{error}</pre>
              </div>
            </div>
          )}
          {result && <ResultTable result={result}/>}
        </div>
      </div>
    </div>
  );
}
