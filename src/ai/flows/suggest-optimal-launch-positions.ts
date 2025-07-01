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
    .describe('A description of the level structure, including target positions and materials.'),
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
  prompt: `You are an AI expert in trajectory calculation and game strategy, tasked with suggesting optimal launch positions in an Angry Birds-like game.

  Analyze the provided level structure, bird type, and power, and suggest launch positions that will maximize destruction and target completion.

  Level Structure: {{{levelStructure}}}
  Bird Type: {{{birdType}}}
  Launch Power: {{{power}}}

  Consider the following factors when determining the optimal launch positions:
  - Trajectory: Calculate the trajectory of the bird based on the launch power and angle.
  - Weak Points: Identify the weak points in the target structure.
  - Material: Consider the material of the target structure.

  Return the suggested launch positions and a brief rationale for your suggestions.
  Ensure that the suggested positions are within the bounds of the screen, and are valid numbers.

  Output in JSON format.
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
