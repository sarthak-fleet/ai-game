import { create } from "zustand";

export interface DialogueLine {
  speaker: "player" | "npc" | "event";
  speakerName: string;
  text: string;
}

export interface InteractionTarget {
  kind: "npc" | "item" | "prop" | "door";
  id: string;
  label: string;
  verb: string;
}

interface UiStore {
  dialogueNpcId: string | null;
  dialogueLines: DialogueLine[];
  dialogueBusy: boolean;
  interactionTarget: InteractionTarget | null;
  /** building id whose interior the player is currently inside, if any */
  interiorBuildingId: string | null;
  setInteriorBuildingId: (buildingId: string | null) => void;
  openDialogue: (npcId: string) => void;
  setDialogueLines: (lines: DialogueLine[]) => void;
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
  interiorBuildingId: null,

  setInteriorBuildingId(buildingId) {
    set({ interiorBuildingId: buildingId });
  },

  openDialogue(npcId) {
    if (get().dialogueNpcId === npcId) return;
    set({ dialogueNpcId: npcId, dialogueLines: [], dialogueBusy: false });
  },
  setDialogueLines(lines) {
    set({ dialogueLines: lines });
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
