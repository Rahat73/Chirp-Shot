"use server";

import {
  suggestOptimalLaunchPositions,
  type SuggestOptimalLaunchPositionsInput,
  type SuggestOptimalLaunchPositionsOutput,
} from "@/ai/flows/suggest-optimal-launch-positions";

export async function getAiSuggestion(
  input: SuggestOptimalLaunchPositionsInput
): Promise<SuggestOptimalLaunchPositionsOutput> {
  return await suggestOptimalLaunchPositions(input);
}
