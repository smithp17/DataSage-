import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import Plot from "react-plotly.js";
import { Send, Bot, User, Square, AlertCircle, Zap, Pin, Maximize2 } from "lucide-react";
import { streamAnalysis } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ChatMessage, ChartSpec, SavedChart } from "@/types";
import clsx from "clsx";

const Cursor = () => (
  <span className="inline-block w-0.5 h-[1em] ml-0.5 align-middle animate-pulse" style={{ background: "var(--acid)" }} />
);

const ThinkingDots = () => (
  <div className="flex gap-3 msg-animate">
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 glow-plasma"
      style={{ background: "linear-gradient(135deg,rgba(191,90,242,0.3),rgba(0,255,255,0.2))", border: "1px solid rgba(191,90,242,0.4)" }}>
      <Bot size={14} style={{ color: "var(--plasma)" }} />
    </div>
    <div className="glass px-4 py-3 flex items-center gap-2.5" style={{ borderRadius: 14 }}>
      <Zap size={12} style={{ color: "var(--acid)" }} className="animate-pulse" />
      <span className="font-hero text-xs" style={{ color: "var(--text-2)" }}>Analysing…</span>
      <span className="flex gap-1 ml-1">
        {[1,2,3].map(i => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full dot${i}`}
            style={{ background: i===1?"var(--acid)":i===2?"var(--cyan)":"var(--plasma)" }} />
        ))}
      </span>
    </div>
  </div>
);

function Bubble({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={clsx("flex gap-3 msg-animate", isUser && "flex-row-reverse")}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={isUser ? {
          background: "var(--acid)", boxShadow: "0 0 14px rgba(223,255,0,0.4)",
        } : {
          background: "linear-gradient(135deg,rgba(191,90,242,0.25),rgba(0,255,255,0.15))",
          border: "1px solid rgba(191,90,242,0.35)",
        }}>
        {isUser
          ? <User size={13} color="#000" />
          : <Bot size={13} style={{ color: "var(--plasma)" }} />}
      </div>
      <div className={clsx("flex flex-col gap-1.5 max-w-[82%]", isUser && "items-end")}>
        <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={isUser ? {
            background: "var(--acid)", color: "#000",
            borderRadius: "14px 2px 14px 14px",
            fontFamily: "var(--font-hero)", fontWeight: 500,
            boxShadow: "0 4px 20px rgba(223,255,0,0.2)",
          } : {
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "2px 14px 14px 14px",
            color: "rgba(255,255,255,0.85)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}>
          {msg.content || (streaming ? "" : "…")}
          {streaming && <Cursor />}
        </div>
        <span className="font-mono text-[10px] px-1" style={{ color: "var(--text-3)" }}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function LiveChartPanel({ spec, loading }: { spec: ChartSpec | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const addChart = useStore(s => s.addChart);
  const saved    = useStore(s => s.savedCharts);
  const dataset  = useStore(s => s.activeDataset);
  const alreadySaved = spec ? saved.some(c => c.title === spec.title) : false;

  const pin = useCallback(() => {
    if (!spec || alreadySaved) return;
    addChart({
      id: crypto.randomUUID(), title: spec.title,
      chart_type: spec.chart_type, spec,
      created_at: Date.now(), dataset_id: dataset?.dataset_id,
    } as SavedChart);
  }, [spec, alreadySaved, addChart, dataset]);

  return (
    <div className="flex flex-col h-full bg-dots" style={{ background: "var(--carbon)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ background: "rgba(5,5,5,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div className="pulse-dot w-2 h-2"
            style={{ background: loading ? "var(--acid)" : spec ? "var(--cyan)" : "var(--ash)" }} />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest"
            style={{ color: loading ? "var(--acid)" : spec ? "var(--cyan)" : "var(--text-3)" }}>
            {loading ? "Generating" : spec ? "Live Chart" : "Chart Panel"}
          </span>
        </div>
        {spec && (
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(true)}
              className="p-1.5 rounded-lg transition-all hover:bg-white/5"
              style={{ color: "var(--text-3)" }}>
              <Maximize2 size={13} />
            </button>
            <button onClick={pin} disabled={alreadySaved}
              className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-hero font-medium transition-all btn-acid")}
              style={alreadySaved ? { background: "rgba(223,255,0,0.1)", color: "var(--acid)", cursor: "default" } : {}}>
              <Pin size={12} />
              {alreadySaved ? "Pinned" : "Pin"}
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        {loading && !spec && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border border-acid/20 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-t-acid border-r-cyan border-b-plasma border-l-transparent animate-spin" />
              <div className="absolute inset-4 rounded-full border border-acid/30 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-hero font-semibold text-white text-sm">Building visualization</p>
              <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text-3)" }}>AI analysing your data…</p>
            </div>
          </div>
        )}
        {!loading && !spec && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="13" width="4" height="8" rx="1" fill="#DFFF00" opacity="0.8"/>
                  <rect x="9" y="8"  width="4" height="13" rx="1" fill="#00FFFF" opacity="0.8"/>
                  <rect x="16" y="3" width="4" height="18" rx="1" fill="#BF5AF2" opacity="0.8"/>
                </svg>
              </div>
            </div>
            <div>
              <p className="font-hero font-medium text-sm" style={{ color: "var(--text-2)" }}>No chart yet</p>
              <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text-3)" }}>Ask for a visualization in the chat</p>
            </div>
          </div>
        )}
        {spec && (
          <Plot
            data={spec.data as Plotly.Data[]}
            layout={{ ...(spec.layout as Partial<Plotly.Layout>), autosize: true }}
            config={{
              displayModeBar: true, displaylogo: false, responsive: true,
              modeBarButtonsToRemove: ["sendDataToCloud" as Plotly.ModeBarDefaultButtons],
              toImageButtonOptions: { format: "png", filename: spec.title, width: 1400, height: 800, scale: 2 },
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        )}
      </div>

      {spec && (
        <div className="px-4 py-2 border-t flex items-center justify-between shrink-0"
          style={{ background: "rgba(5,5,5,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
          <span className="font-mono text-[11px] truncate" style={{ color: "var(--text-2)" }}>{spec.title}</span>
          <span className="badge badge-acid ml-2 shrink-0">{spec.chart_type}</span>
        </div>
      )}

      {/* Fullscreen modal */}
      {expanded && spec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)" }}
          onClick={() => setExpanded(false)}>
          <div className="w-full max-w-6xl glass-cyan rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "rgba(0,255,255,0.15)" }}>
              <div className="flex items-center gap-3">
                <span className="badge badge-cyan">{spec.chart_type}</span>
                <span className="font-hero font-semibold text-white">{spec.title}</span>
              </div>
              <button onClick={() => setExpanded(false)}
                className="font-hero text-sm transition-colors hover:text-acid"
                style={{ color: "var(--text-2)" }}>✕ Close</button>
            </div>
            <Plot
              data={spec.data as Plotly.Data[]}
              layout={{ ...(spec.layout as Partial<Plotly.Layout>), autosize: true, height: 600 }}
              config={{ displayModeBar: true, displaylogo: false, responsive: true }}
              style={{ width: "100%" }} useResizeHandler
            />
          </div>
        </div>
      )}
    </div>
  );
}

const CHIPS = [
  { label: "Overview & key stats",     badge: "badge-acid" },
  { label: "Top 10 — bar chart",       badge: "badge-cyan" },
  { label: "Trend over time",           badge: "badge-plasma" },
  { label: "Distribution histogram",   badge: "badge-acid" },
  { label: "Correlation heatmap",      badge: "badge-cyan" },
  { label: "Category donut chart",     badge: "badge-ember" },
  { label: "Scatter: compare columns", badge: "badge-plasma" },
  { label: "Find outliers",            badge: "badge-ember" },
];

export default function AnalystPage() {
  const { activeDataset, messages, addMessage, liveChart, setLiveChart } = useStore();
  const [input,      setInput]      = useState("");
  const [thinking,   setThinking]   = useState(false);
  const [streaming,  setStreaming]   = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error,      setError]      = useState("");
  const cancelRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamText, thinking]);

  const buildHistory = useCallback(() =>
    messages.slice(-8).map(m => ({ role: m.role, content: m.content })), [messages]);

  const finalize = useCallback((text: string, chart: ChartSpec | null) => {
    addMessage({ role: "assistant", content: text, chart: chart ?? undefined, timestamp: Date.now() });
    setStreaming(false); setThinking(false); setStreamText(""); cancelRef.current = null;
  }, [addMessage]);

  const send = useCallback((text: string) => {
    if (!activeDataset || !text.trim() || thinking || streaming) return;
    setError(""); setStreamText(""); setLiveChart(null);
    addMessage({ role: "user", content: text.trim(), timestamp: Date.now() });
    setInput(""); setThinking(true);
    let acc = ""; let foundChart: ChartSpec | null = null;
    cancelRef.current = streamAnalysis(
      activeDataset.dataset_id, text.trim(), buildHistory(),
      chunk => { setThinking(false); setStreaming(true); acc += chunk; setStreamText(acc); },
      spec  => { foundChart = spec; setLiveChart(spec); },
      ()    => finalize(acc, foundChart),
      msg   => { setError(msg); setThinking(false); setStreaming(false); },
    );
  }, [activeDataset, thinking, streaming, buildHistory, addMessage, setLiveChart, finalize]);

  const stop = useCallback(() => {
    cancelRef.current?.();
    if (streamText) finalize(streamText + " _(stopped)_", liveChart);
    else { setThinking(false); setStreaming(false); }
  }, [streamText, liveChart, finalize]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const isGenerating = thinking || streaming;

  if (!activeDataset) return (
    <div className="flex-1 flex items-center justify-center bg-dots" style={{ background: "var(--carbon)" }}>
      <div className="text-center max-w-sm reveal in-view">
        <div className="w-28 h-28 mx-auto mb-6 rounded-3xl glass flex items-center justify-center"
          style={{ boxShadow: "0 0 60px rgba(223,255,0,0.1)" }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="13" width="4" height="8" rx="1.5" fill="#DFFF00"/>
            <rect x="9" y="8"  width="4" height="13" rx="1.5" fill="#00FFFF"/>
            <rect x="16" y="3" width="4" height="18" rx="1.5" fill="#BF5AF2"/>
            <path d="M2 21h20" stroke="#2A2A2A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="font-display text-white font-bold text-2xl mb-3 uppercase tracking-wider">
          <span className="grad-acid">DataSage</span>
        </h2>
        <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Upload a dataset from the sidebar to unlock AI-powered analysis, live charts, and SQL queries.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {["CSV","Excel","JSON","Parquet"].map(t => (
            <span key={t} className="badge badge-white">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full" style={{ background: "var(--void)" }}>
      {/* ── Chat (55%) ── */}
      <div className="flex flex-col border-r" style={{ width: "55%", borderColor: "rgba(255,255,255,0.06)" }}>
        {/* Dataset bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ background: "rgba(5,5,5,0.9)", borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center gap-3">
            <div className="pulse-dot w-2 h-2" style={{ background: "var(--acid)" }} />
            <span className="font-hero font-semibold text-white text-sm">{activeDataset.filename}</span>
            <span className="badge badge-acid">{activeDataset.rows.toLocaleString()} rows</span>
            <span className="badge badge-cyan">{activeDataset.columns} cols</span>
          </div>
          <button onClick={() => send("Give me a comprehensive overview — key stats, patterns, and one compelling visualization.")}
            disabled={isGenerating}
            className="btn-acid text-xs py-1.5 px-3 disabled:opacity-40">
            <Zap size={12} /> Auto Insights
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-dots"
          style={{ background: "var(--carbon)" }}>
          {messages.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="w-14 h-14 rounded-2xl glass-plasma flex items-center justify-center">
                <Bot size={24} style={{ color: "var(--plasma)" }} />
              </div>
              <div className="text-center">
                <p className="font-hero font-semibold text-white mb-1">Ask anything about your data</p>
                <p className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                  or click <span style={{ color: "var(--acid)" }}>Auto Insights</span> for an instant overview
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {CHIPS.map(({ label, badge }) => (
                  <button key={label} onClick={() => send(label)}
                    className={`text-left text-xs px-3 py-2.5 rounded-xl ${badge} transition-all hover:opacity-80 font-hero font-medium`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          {thinking && !streaming && <ThinkingDots />}
          {streaming && streamText && (
            <Bubble msg={{ role: "assistant", content: streamText, timestamp: Date.now() }} streaming />
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
              style={{ background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.25)", color: "var(--ember)" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4 shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(5,5,5,0.9)", backdropFilter: "blur(12px)" }}>
          <div className="flex gap-3 items-end glass px-4 py-3 transition-all"
            style={{ borderRadius: 14 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder="Ask anything… (Enter to send)" rows={1} disabled={isGenerating}
              className="flex-1 bg-transparent text-sm resize-none outline-none max-h-28 leading-relaxed font-body"
              style={{ color: "rgba(255,255,255,0.85)", caretColor: "var(--acid)" }}
              onFocus={e => e.target.closest<HTMLElement>(".glass")!.style.borderColor = "rgba(223,255,0,0.3)"}
              onBlur={e => e.target.closest<HTMLElement>(".glass")!.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            {isGenerating
              ? <button onClick={stop} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)", color: "var(--ember)" }}>
                  <Square size={12} fill="currentColor" />
                </button>
              : <button onClick={() => send(input)} disabled={!input.trim()}
                  className="btn-acid w-8 h-8 p-0 flex items-center justify-center rounded-lg shrink-0 disabled:opacity-30">
                  <Send size={13} color="#000" />
                </button>
            }
          </div>
          <p className="font-mono text-[10px] mt-2 text-center" style={{ color: "var(--text-3)" }}>
            Llama 3.1 via Groq · Verify critical findings before decisions
          </p>
        </div>
      </div>

      {/* ── Live Chart (45%) ── */}
      <div className="flex-1 min-w-0">
        <LiveChartPanel spec={liveChart} loading={isGenerating} />
      </div>
    </div>
  );
}
