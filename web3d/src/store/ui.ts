import { create } from "zustand";

export interface DialogueLine {
  speaker: "player" | "npc";
  speakerName: string;
  text: string;
}

export interface InteractionTarget {
  kind: "npc" | "item" | "prop";
  id: string;
  label: string;
  verb: string;
}

interface UiStore {
  dialogueNpcId: string | null;
  dialogueLines: DialogueLine[];
  dialogueBusy: boolean;
  interactionTarget: InteractionTarget | null;
  openDialogue: (npcId: string) => void;
  pushDialogueLine: (line: DialogueLine) => void;
  setDialogueBusy: (busy: boolean) => void;
  closeDialogue: () => void;
  setInteractionTarget: (target: InteractionTarget | null) => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  dialogueNpcId: null,
  dialogueLines: [],
  dialogueBusy: false,
  interactionTarget: null,

  openDialogue(npcId) {
    if (get().dialogueNpcId === npcId) return;
    set({ dialogueNpcId: npcId, dialogueLines: [], dialogueBusy: false });
  },
  pushDialogueLine(line) {
    set({ dialogueLines: [...get().dialogueLines, line] });
  },
  setDialogueBusy(busy) {
    set({ dialogueBusy: busy });
  },
  closeDialogue() {
    set({ dialogueNpcId: null, dialogueLines: [], dialogueBusy: false });
  },
  setInteractionTarget(target) {
    const current = get().interactionTarget;
    if (current?.id === target?.id && current?.kind === target?.kind) return;
    set({ interactionTarget: target });
  },
}));
