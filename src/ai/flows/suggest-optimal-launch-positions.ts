'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting optimal launch positions in the Chirp Shot game.
 *
 * - suggestOptimalLaunchPositions - A function that suggests optimal launch positions based on level structure.
 * - SuggestOptimalLaunchPositionsInput - The input type for the suggestOptimalLaunchPositions function.
 * - SuggestOptimalLaunchPositionsOutput - The return type for the suggestOptimalLaunchPositions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestOptimalLaunchPositionsInputSchema = z.object({
  levelStructure: z
    .string()
    .describe('A description of the level structure, including pig and block positions.'),
  birdType: z.string().describe('The type of bird being launched.'),
  power: z.number().describe('The current launch power.'),
});
export type SuggestOptimalLaunchPositionsInput = z.infer<
  typeof SuggestOptimalLaunchPositionsInputSchema
>;

const SuggestOptimalLaunchPositionsOutputSchema = z.object({
  suggestedPositions: z
    .array(z.object({x: z.number(), y: z.number()}))
    .describe('An array of suggested launch positions (x, y coordinates).'),
  rationale: z.string().describe('The AI rationale for suggesting these positions.'),
});
export type SuggestOptimalLaunchPositionsOutput = z.infer<
  typeof SuggestOptimalLaunchPositionsOutputSchema
>;

export async function suggestOptimalLaunchPositions(
  input: SuggestOptimalLaunchPositionsInput
): Promise<SuggestOptimalLaunchPositionsOutput> {
  return suggestOptimalLaunchPositionsFlow(input);
}

const suggestOptimalLaunchPositionsPrompt = ai.definePrompt({
  name: 'suggestOptimalLaunchPositionsPrompt',
  input: {schema: SuggestOptimalLaunchPositionsInputSchema},
  output: {schema: SuggestOptimalLaunchPositionsOutputSchema},
  prompt: `You are an AI expert in trajectory calculation and game strategy, tasked with suggesting optimal launch positions in a physics-based game where the goal is to eliminate all pigs.

  Analyze the provided level structure, including the positions of blocks and pigs, along with the bird type and launch power. Suggest launch positions that will efficiently eliminate the pigs.
  The primary goal is to hit the pigs. Destroying blocks is a means to an end.

  Level Structure: {{{levelStructure}}}
  Bird Type: {{{birdType}}}
  Launch Power: {{{power}}}

  Consider the following factors:
  - Trajectory: Calculate the bird's path to hit the pigs directly or by causing structures to collapse on them.
  - Weak Points: Identify structural weak points to clear a path to the pigs.
  - Chain Reactions: Prioritize shots that could cause a chain reaction, eliminating multiple pigs or clearing significant obstacles.
  
  Return the suggested launch positions and a brief rationale for your suggestions, focusing on the strategy to defeat the pigs.
  Ensure the output is in JSON format.
  `,
});

const suggestOptimalLaunchPositionsFlow = ai.defineFlow(
  {
    name: 'suggestOptimalLaunchPositionsFlow',
    inputSchema: SuggestOptimalLaunchPositionsInputSchema,
    outputSchema: SuggestOptimalLaunchPositionsOutputSchema,
  },
  async input => {
    const {output} = await suggestOptimalLaunchPositionsPrompt(input);
    return output!;
  }
);
