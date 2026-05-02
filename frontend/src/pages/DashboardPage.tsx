import { useRef, useCallback, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { FileDown, ImageDown, Trash2, LayoutDashboard, GripVertical,
         X, Maximize2, Minimize2, Download, Copy } from "lucide-react";
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import Plot from "react-plotly.js";
import { SavedChart } from "@/types";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const CARD_ACCENT = [
  { b:"rgba(223,255,0,0.25)",  bg:"rgba(223,255,0,0.04)",  glow:"rgba(223,255,0,0.08)",  badge:"badge-acid"   },
  { b:"rgba(0,255,255,0.25)",  bg:"rgba(0,255,255,0.04)",  glow:"rgba(0,255,255,0.08)",  badge:"badge-cyan"   },
  { b:"rgba(191,90,242,0.25)", bg:"rgba(191,90,242,0.04)", glow:"rgba(191,90,242,0.08)", badge:"badge-plasma" },
  { b:"rgba(255,107,53,0.25)", bg:"rgba(255,107,53,0.04)", glow:"rgba(255,107,53,0.08)", badge:"badge-ember"  },
  { b:"rgba(16,185,129,0.25)", bg:"rgba(16,185,129,0.04)", glow:"rgba(16,185,129,0.08)", badge:"badge-cyan"   },
  { b:"rgba(59,130,246,0.25)", bg:"rgba(59,130,246,0.04)", glow:"rgba(59,130,246,0.08)", badge:"badge-plasma" },
];

/* ── Download chart PNG via Plotly ── */
async function downloadChartPNG(containerId: string, filename: string) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const plotEl = el.querySelector(".js-plotly-plot") as HTMLElement;
  if (!plotEl) return;
  const Plotly = await import("plotly.js");
  (Plotly as unknown as { downloadImage: (el: HTMLElement, opts: object) => void })
    .downloadImage(plotEl, { format: "png", filename, width: 1400, height: 800, scale: 2 });
}

/* ── Single chart card ── */
function ChartCard({
  chart, idx, onRemove, onDuplicate,
}: {
  chart: SavedChart; idx: number;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cardId = `chart-card-${chart.id}`;
  const s = CARD_ACCENT[idx % CARD_ACCENT.length];

  const downloadPNG = useCallback(() => downloadChartPNG(cardId, chart.title), [cardId, chart.title]);

  return (
    <>
      {/* ── Grid card ── */}
      <div id={cardId} className="h-full flex flex-col rounded-2xl overflow-hidden group relative"
        style={{
          background: `linear-gradient(145deg, rgba(5,5,5,0.95), ${s.bg})`,
          border: `1px solid ${s.b}`,
          boxShadow: `0 0 40px ${s.glow}`,
          transition: "box-shadow 0.3s",
        }}>

        {/* Drag handle header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
          style={{ borderColor:"rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.5)" }}>
          <GripVertical size={13} className="drag-handle cursor-grab select-none shrink-0"
            style={{ color:"var(--text-3)" }} />
          <span className={`badge ${s.badge} shrink-0 text-[9px]`}>{chart.chart_type}</span>
          <span className="font-hero text-xs font-semibold text-white truncate flex-1" title={chart.title}>
            {chart.title}
          </span>

          {/* Floating toolbar — visible on hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
            <button onClick={() => setExpanded(true)} title="Fullscreen"
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-acid/20 hover:text-acid"
              style={{ color:"var(--text-3)" }}>
              <Maximize2 size={11} />
            </button>
            <button onClick={downloadPNG} title="Download PNG"
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-cyan/20 hover:text-cyan"
              style={{ color:"var(--text-3)" }}>
              <Download size={11} />
            </button>
            <button onClick={onDuplicate} title="Duplicate"
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-plasma/20 hover:text-plasma"
              style={{ color:"var(--text-3)" }}>
              <Copy size={11} />
            </button>
            <button onClick={onRemove} title="Remove"
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-ember/20 hover:text-ember"
              style={{ color:"var(--text-3)" }}>
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Chart fills remaining space — fully responsive */}
        <div className="flex-1 min-h-0 min-w-0">
          <Plot
            data={chart.spec.data as Plotly.Data[]}
            layout={{
              ...(chart.spec.layout as Partial<Plotly.Layout>),
              autosize: true,
              margin:   { l:44, r:12, t:32, b:44 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor:  "rgba(0,0,0,0)",
              title: undefined,   // title shown in header
            }}
            config={{ displayModeBar:false, responsive:true }}
            style={{ width:"100%", height:"100%" }}
            useResizeHandler
          />
        </div>
      </div>

      {/* ── Fullscreen modal ── */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background:"rgba(0,0,0,0.95)", backdropFilter:"blur(16px)" }}
          onClick={() => setExpanded(false)}>
          <div className="w-full max-w-7xl flex flex-col rounded-2xl overflow-hidden glass"
            style={{ borderColor: s.b, maxHeight:"90vh" }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor:"rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.6)" }}>
              <div className="flex items-center gap-3">
                <span className={`badge ${s.badge}`}>{chart.chart_type}</span>
                <span className="font-hero font-bold text-white text-base">{chart.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadPNG}
                  className="btn-ghost text-xs py-1.5 px-3">
                  <Download size={13} /> PNG
                </button>
                <button onClick={() => setExpanded(false)}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center transition-all hover:text-acid"
                  style={{ color:"var(--text-2)" }}>
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>

            {/* Full chart */}
            <div style={{ height:"75vh" }}>
              <Plot
                data={chart.spec.data as Plotly.Data[]}
                layout={{
                  ...(chart.spec.layout as Partial<Plotly.Layout>),
                  autosize: true,
                  margin: { l:64, r:32, t:48, b:64 },
                  title: {
                    text: chart.title,
                    font: { color:"#fff", size:20, family:"Space Grotesk, sans-serif" },
                    x: 0.04,
                  },
                }}
                config={{
                  displayModeBar: true, displaylogo: false, responsive: true,
                  modeBarButtonsToRemove: ["sendDataToCloud" as Plotly.ModeBarDefaultButtons],
                  toImageButtonOptions: { format:"png", filename:chart.title, width:1600, height:900, scale:2 },
                }}
                style={{ width:"100%", height:"100%" }}
                useResizeHandler
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Responsive grid ── */
function DashboardGrid() {
  const { savedCharts, removeChart, addChart } = useStore();

  const [layouts, setLayouts] = useState<{ lg: Layout[]; md: Layout[]; sm: Layout[] }>(() => {
    const base = savedCharts.map((c, i) => ({
      i: c.id, x: (i % 2) * 6, y: Math.floor(i / 2) * 6, w: 6, h: 7, minW: 3, minH: 4,
    }));
    return { lg: base, md: base, sm: base.map(l => ({ ...l, w: Math.min(l.w, 6), x: 0 })) };
  });

  // Sync new charts into layout
  useEffect(() => {
    setLayouts(prev => {
      const lgIds = new Set(prev.lg.map(l => l.i));
      const newItems = savedCharts
        .filter(c => !lgIds.has(c.id))
        .map((c, i) => {
          const existingCount = prev.lg.length;
          return { i: c.id, x: (existingCount % 2) * 6, y: existingCount * 7, w: 6, h: 7, minW: 3, minH: 4 };
        });
      if (!newItems.length) return prev;
      return {
        lg: [...prev.lg, ...newItems],
        md: [...prev.md, ...newItems],
        sm: [...prev.sm, ...newItems.map(l => ({ ...l, w: 6, x: 0 }))],
      };
    });
  }, [savedCharts.length]);

  const duplicate = useCallback((chart: SavedChart) => {
    addChart({
      ...chart,
      id: crypto.randomUUID(),
      title: `${chart.title} (copy)`,
      created_at: Date.now(),
    });
  }, [addChart]);

  if (savedCharts.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
      <div className="w-24 h-24 rounded-3xl glass-acid flex items-center justify-center"
        style={{ boxShadow:"0 0 60px rgba(223,255,0,0.08)" }}>
        <LayoutDashboard size={40} style={{ color:"var(--acid)" }} />
      </div>
      <div>
        <h3 className="font-display font-bold text-white text-lg uppercase tracking-wider mb-2">
          Dashboard Empty
        </h3>
        <p className="font-body text-sm max-w-xs" style={{ color:"var(--text-2)" }}>
          Go to <span style={{ color:"var(--plasma)" }}>Analyst</span> → generate a chart →
          click <span style={{ color:"var(--acid)" }}>Pin</span>
        </p>
      </div>
    </div>
  );

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg:1200, md:996, sm:768 }}
      cols={{ lg:12, md:10, sm:6 }}
      rowHeight={65}
      draggableHandle=".drag-handle"
      onLayoutChange={(_, allLayouts) => setLayouts(allLayouts as typeof layouts)}
      isResizable
      isDraggable
      resizeHandles={["s","w","e","n","sw","nw","se","ne"]}
      margin={[16, 16]}
      containerPadding={[0, 0]}
    >
      {savedCharts.map((chart, idx) => (
        <div key={chart.id}>
          <ChartCard
            chart={chart} idx={idx}
            onRemove={() => removeChart(chart.id)}
            onDuplicate={() => duplicate(chart)}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}

/* ── Page ── */
export default function DashboardPage() {
  const { savedCharts, clearCharts } = useStore();
  const gridRef = useRef<HTMLDivElement>(null);

  const capture = useCallback(async () => {
    if (!gridRef.current) return null;
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(gridRef.current, { scale:2, backgroundColor:"#000000", useCORS:true, logging:false });
  }, []);

  const exportPNG = useCallback(async () => {
    const c = await capture(); if (!c) return;
    const a = document.createElement("a");
    a.download = "dashboard.png"; a.href = c.toDataURL("image/png"); a.click();
  }, [capture]);

  const exportPDF = useCallback(async () => {
    const c = await capture(); if (!c) return;
    const { default: jsPDF } = await import("jspdf");
    const w = c.width / 2, h = c.height / 2;
    const pdf = new jsPDF({ orientation: w>h?"landscape":"portrait", unit:"px", format:[w,h] });
    pdf.addImage(c.toDataURL("image/png"), "PNG", 0, 0, w, h);
    pdf.save("dashboard.pdf");
  }, [capture]);

  return (
    <div className="flex flex-col h-full" style={{ background:"var(--void)" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ background:"rgba(5,5,5,0.9)", borderColor:"rgba(255,255,255,0.06)", backdropFilter:"blur(12px)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:"rgba(255,107,53,0.15)", border:"1px solid rgba(255,107,53,0.3)" }}>
            <LayoutDashboard size={16} style={{ color:"var(--ember)" }} />
          </div>
          <div>
            <h1 className="font-display font-bold text-white text-sm uppercase tracking-wider">
              Dashboard
            </h1>
            <p className="font-mono text-[10px] mt-0.5" style={{ color:"var(--text-3)" }}>
              {savedCharts.length} chart{savedCharts.length!==1?"s":""} · drag handle to move · resize from any edge
            </p>
          </div>
        </div>

        {savedCharts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] mr-2 hidden md:block" style={{ color:"var(--text-3)" }}>
              hover a card for tools
            </span>
            <button onClick={exportPNG} className="btn-ghost text-xs py-1.5 px-3">
              <ImageDown size={13} /> PNG
            </button>
            <button onClick={exportPDF} className="btn-acid text-xs py-1.5 px-4">
              <FileDown size={13} /> PDF
            </button>
            <button onClick={() => confirm("Remove all charts?") && clearCharts()}
              className="p-2 rounded-lg hover:bg-ember/20 transition-all"
              style={{ color:"var(--text-3)" }}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div ref={gridRef} className="flex-1 overflow-auto p-4 bg-dots"
        style={{ background:"var(--carbon)", minHeight:0 }}>
        <DashboardGrid />
      </div>
    </div>
  );
}
