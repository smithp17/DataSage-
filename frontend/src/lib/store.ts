import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DatasetMeta, ChatMessage, SavedChart, ChartSpec } from "@/types";

interface AppState {
  // ── Datasets ───────────────────────────────────────────────
  datasets:      DatasetMeta[];
  activeDataset: DatasetMeta | null;
  addDataset:    (d: DatasetMeta) => void;
  removeDataset: (id: string) => void;
  setActive:     (d: DatasetMeta | null) => void;

  // ── Chat history per dataset ───────────────────────────────
  messages:      ChatMessage[];
  addMessage:    (m: ChatMessage) => void;
  clearMessages: () => void;

  // ── Live chart (streaming) ─────────────────────────────────
  liveChart:    ChartSpec | null;
  setLiveChart: (c: ChartSpec | null) => void;

  // ── Saved dashboard charts ─────────────────────────────────
  savedCharts:    SavedChart[];
  addChart:       (c: SavedChart) => void;
  removeChart:    (id: string) => void;
  clearCharts:    () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      datasets:      [],
      activeDataset: null,
      addDataset:    (d) => set((s) => ({
        datasets:      s.datasets.some((x) => x.dataset_id === d.dataset_id)
                         ? s.datasets
                         : [...s.datasets, d],
        activeDataset: d,
        messages:      [],
        liveChart:     null,
      })),
      removeDataset: (id) => set((s) => ({
        datasets:      s.datasets.filter((d) => d.dataset_id !== id),
        activeDataset: s.activeDataset?.dataset_id === id ? null : s.activeDataset,
      })),
      setActive: (d) => set({ activeDataset: d, messages: [], liveChart: null }),

      messages:      [],
      addMessage:    (m) => set((s) => ({ messages: [...s.messages, m] })),
      clearMessages: () => set({ messages: [] }),

      liveChart:    null,
      setLiveChart: (c) => set({ liveChart: c }),

      savedCharts:  [],
      addChart:     (c) => set((s) => ({ savedCharts: [...s.savedCharts, c] })),
      removeChart:  (id) => set((s) => ({
        savedCharts: s.savedCharts.filter((c) => c.id !== id),
      })),
      clearCharts:  () => set({ savedCharts: [] }),
    }),
    {
      name:        "datasage-store",
      partialize:  (s) => ({ savedCharts: s.savedCharts, datasets: s.datasets }),
    }
  )
);
