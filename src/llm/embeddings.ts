/** Text embeddings for semantic memory recall through the pinned Vercel AI SDK. */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { embed as embedValue } from 'ai';

let embeddingsDisabled = false;

function embeddingConfig(): { baseURL: string; apiKey: string; model: string } | null {
  const baseURL = process.env['LLM_BASE_URL']?.replace(/\/+$/, '');
  const model = process.env['LLM_MODEL_EMBED'];
  if (!baseURL || !model) return null;
  return {
    baseURL,
    apiKey: process.env['LLM_API_KEY'] || 'local-no-key',
    model,
  };
}

/** Embed one string. Returns null when unavailable so callers fall back to keywords. */
export async function embed(text: string): Promise<number[] | null> {
  const config = embeddingConfig();
  if (embeddingsDisabled || !config || !text.trim()) return null;
  try {
    const provider = createOpenAICompatible({
      name: 'aliveville-direct',
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    const result = await embedValue({
      model: provider.embeddingModel(config.model),
      value: text,
      maxRetries: 0,
    });
    return result.embedding.length > 0 ? result.embedding : null;
  } catch {
    embeddingsDisabled = true;
    return null;
  }
}
