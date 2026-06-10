import { type FormEvent, useEffect, useRef, useState } from "react";

import { type DialogueResponse, fetchDialogueHistory, postDialogue } from "../api/client.ts";
import { setFollowing } from "../characters/followers.ts";
import { useUiStore } from "../store/ui.ts";
import { npcById, useWorldStore } from "../store/world.ts";

// remembered per session so the scripted fallback skips a wasted round-trip
let llmDialogueAvailable: boolean | null = null;

interface Relationship {
  score: number;
  label: string;
}

export function Dialogue() {
  const dialogueNpcId = useUiStore((state) => state.dialogueNpcId);
  const lines = useUiStore((state) => state.dialogueLines);
  const busy = useUiStore((state) => state.dialogueBusy);
  const pushLine = useUiStore((state) => state.pushDialogueLine);
  const setLines = useUiStore((state) => state.setDialogueLines);
  const setBusy = useUiStore((state) => state.setDialogueBusy);
  const closeDialogue = useUiStore((state) => state.closeDialogue);
  const world = useWorldStore((state) => state.world);
  const send = useWorldStore((state) => state.send);
  const [draft, setDraft] = useState("");
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const npc = npcById(world, dialogueNpcId);

  // load the shared past: previous conversations + current relationship
  useEffect(() => {
    if (!dialogueNpcId) return;
    inputRef.current?.focus();
    if (llmDialogueAvailable === false) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchDialogueHistory(dialogueNpcId);
        if (cancelled || !response.llm) return;
        llmDialogueAvailable = true;
        if (response.relationship) setRelationship(response.relationship);
        const currentNpc = npcById(useWorldStore.getState().world, dialogueNpcId);
        if (response.turns?.length && currentNpc) {
          setLines(
            response.turns.map((turn) => ({
              speaker: turn.speaker,
              speakerName: turn.speaker === "player" ? "You" : turn.speaker === "npc" ? currentNpc.name : "",
              text: turn.text,
            }))
          );
        }
      } catch {
        // history is a nice-to-have; conversation still works without it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogueNpcId, setLines]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") closeDialogue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDialogue]);

  if (!npc) return null;

  const handleLlmResponse = (response: DialogueResponse): boolean => {
    if (!response.llm) return false;
    llmDialogueAvailable = true;
    if (response.relationship) setRelationship(response.relationship);
    if (response.reply) {
      pushLine({ speaker: "npc", speakerName: npc.name, text: response.reply });
      if (response.action) {
        pushLine({ speaker: "event", speakerName: "", text: response.action.text });
        if (response.action.type === "follow") setFollowing(npc.id, true);
        if (response.action.type === "unfollow") setFollowing(npc.id, false);
        if (response.action.type === "fight" || response.action.type === "move") {
          window.setTimeout(() => useUiStore.getState().closeDialogue(), 1100);
        }
      }
      return true;
    }
    // LLM mode is on but this call hiccuped (model cooldown/timeout): soft retry line
    pushLine({ speaker: "event", speakerName: "", text: `${npc.name} pauses, lost in thought. (say that again)` });
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    pushLine({ speaker: "player", speakerName: world?.player.name ?? "You", text });
    setBusy(true);

    // LLM conversation first: in-character, free-flowing, no sim tick consumed
    if (llmDialogueAvailable !== false) {
      try {
        const response = await postDialogue(npc.id, text);
        const handled = handleLlmResponse(response);
        if (handled) {
          setBusy(false);
          inputRef.current?.focus();
          return;
        }
        llmDialogueAvailable = false;
      } catch {
        // network failure: fall through to the scripted path once
      }
    }

    // scripted fallback: a talk action through the tick engine
    const summary = await send({ type: "talk", targetId: npc.id, text });
    setBusy(false);
    if (!summary) return;
    const replies = summary.actions.filter((entry) => {
      const action = entry.action;
      return (
        action.actorId === npc.id &&
        (action.type === "talk" || action.type === "confront" || action.type === "gossip")
      );
    });
    for (const entry of replies) {
      const action = entry.action as { text?: string };
      pushLine({ speaker: "npc", speakerName: npc.name, text: action.text ?? entry.text });
    }
    if (replies.length === 0) {
      pushLine({ speaker: "npc", speakerName: npc.name, text: `${npc.name} has nothing to say right now.` });
    }
    inputRef.current?.focus();
  };

  return (
    <div className="dialogue">
      <div className="dialogue-header">
        {npc.appearance?.portrait ? <img className="dialogue-portrait" src={npc.appearance.portrait} alt="" /> : null}
        <div>
          <div className="dialogue-name">{npc.name}</div>
          {npc.role ? <div className="dialogue-role">{npc.role}</div> : null}
        </div>
        {relationship ? (
          <div className={`rel-chip ${relationship.score > 1 ? "good" : relationship.score < -2 ? "bad" : ""}`} title="Relationship">
            {relationship.label}
            <span className="rel-score">{relationship.score > 0 ? `+${relationship.score}` : relationship.score}</span>
          </div>
        ) : null}
        <button type="button" className="dialogue-close" onClick={closeDialogue}>
          ✕
        </button>
      </div>
      <div className="dialogue-log" ref={logRef}>
        {lines.length === 0 ? <div className="dialogue-hint">Say something to {npc.name}…</div> : null}
        {lines.map((line, index) =>
          line.speaker === "event" ? (
            <div key={index} className="dialogue-line event">
              {line.text}
            </div>
          ) : (
            <div key={index} className={`dialogue-line ${line.speaker}`}>
              <span className="dialogue-speaker">{line.speakerName}:</span> {line.text}
            </div>
          )
        )}
        {busy ? <div className="dialogue-line npc thinking">…</div> : null}
      </div>
      <form className="dialogue-input" onSubmit={submit}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Talk to ${npc.name}`}
          maxLength={240}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
