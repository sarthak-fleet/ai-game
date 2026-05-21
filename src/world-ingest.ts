import {
  type AnimeArtifactDraft,
  type AnimeCharacterDraft,
  type AnimeConflictDraft,
  type AnimeFactionDraft,
  type AnimeIngestIssue,
  type AnimeIngestSource,
  type AnimeLocationDraft,
  animeSourceToWorld,
  validateAnimeIngestSource,
} from "./anime-ingest.ts";

export type WorldIngestSource = AnimeIngestSource;
export type WorldLocationDraft = AnimeLocationDraft;
export type WorldCharacterDraft = AnimeCharacterDraft;
export type WorldFactionDraft = AnimeFactionDraft;
export type WorldConflictDraft = AnimeConflictDraft;
export type WorldArtifactDraft = AnimeArtifactDraft;
export type WorldIngestIssue = AnimeIngestIssue;

export const worldSourceToWorld = animeSourceToWorld;
export const validateWorldIngestSource = validateAnimeIngestSource;
