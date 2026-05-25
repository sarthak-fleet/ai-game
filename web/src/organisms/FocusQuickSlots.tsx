import { useState } from "react";

import { Button } from "../atoms/Button.tsx";
import type { QuickSaveSlot } from "../save-slots.ts";
import { describeQuickSlot, loadQuickSlot, saveQuickSlot } from "../save-slots.ts";
import { useWorldStore } from "../store/world.ts";

export function FocusQuickSlots() {
  const world = useWorldStore((s) => s.world);
  const saveSnapshot = useWorldStore((s) => s.saveSnapshot);
  const restoreFromJson = useWorldStore((s) => s.restoreFromJson);
  const [quickSlot, setQuickSlot] = useState<QuickSaveSlot | null>(() => initialQuickSlot());
  const [busy, setBusy] = useState<"" | "saving" | "loading">("");
  const [toast, setToast] = useState<string | null>(null);

  function flash(message: string): void {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  async function handleQuickSave(): Promise<void> {
    setBusy("saving");
    try {
      const snapshot = await saveSnapshot();
      const slot = saveQuickSlot(window.localStorage, snapshot);
      setQuickSlot(slot);
      flash(`Quick saved: ${describeQuickSlot(slot)}`);
    } catch (error) {
      flash(`Quick save failed: ${(error as Error).message}`);
    } finally {
      setBusy("");
    }
  }

  async function handleQuickLoad(): Promise<void> {
    setBusy("loading");
    try {
      const slot = loadQuickSlot(window.localStorage);
      if (!slot) {
        flash("No quick save.");
        return;
      }
      await restoreFromJson(JSON.stringify(slot.snapshot));
      setQuickSlot(slot);
      flash(`Quick loaded: ${describeQuickSlot(slot)}`);
    } catch (error) {
      flash(`Quick load failed: ${(error as Error).message}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="focus-quick-slots" aria-label="Focus quick save">
      {world && <h2>{world.name}</h2>}
      {toast && <span className="header-toast">{toast}</span>}
      <Button onClick={() => void handleQuickSave()} disabled={busy !== ""}>
        Slot Save
      </Button>
      <Button onClick={() => void handleQuickLoad()} disabled={busy !== "" || !quickSlot}>
        Slot Load
      </Button>
    </div>
  );
}

function initialQuickSlot(): QuickSaveSlot | null {
  if (typeof window === "undefined") return null;
  try {
    return loadQuickSlot(window.localStorage);
  } catch {
    return null;
  }
}
