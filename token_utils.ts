/**
 * Token counting utilities using gpt-tokenizer
 * Separated from main utils to avoid LM Studio SDK dependencies
 */

import { encode } from "gpt-tokenizer";

/**
 * Count tokens in output text using GPT tokenizer
 * @param text - Output text to count tokens for
 * @returns Number of tokens
 */
export function countOutputTokens(text: string): number {
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (error) {
    console.warn("Failed to count output tokens, using fallback:", error);
    // Fallback to character-based estimation
    return Math.round(text.length / 4);
  }
}

/**
 * Count tokens in prompt text using GPT tokenizer
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export function countPromptTokens(text: string): number {
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (error) {
    console.warn("Failed to count tokens, using fallback:", error);
    // Fallback to character-based estimation
    return Math.round(text.length / 4);
  }
}