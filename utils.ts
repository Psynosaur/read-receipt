// utils.ts - Utility functions and types for the image parser
import { LMStudioClient } from "@lmstudio/sdk";

/** Performance metrics for timing various operations during image processing */
export const timings = {
  totalStart: performance.now(),
  imageLoad: 0,
  normalization: 0,
  apiRequest: 0,
  total: 0,
};

/**
 * GPU performance tracking interface for collecting stats from LM Studio API responses
 * Tracks various performance metrics including token generation, timing, and model information
 */
export interface GPUStats {
  modelName?: string;
  modelSize?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  generationTime?: number;
  stopReason?: string;
  draftModel?: string;
  totalDraftTokensCount?: number;
  acceptedDraftTokensCount?: number;
  rejectedDraftTokensCount?: number;
  ignoredDraftTokensCount?: number;
  draftAcceptanceRate?: number;
  // Token generation metrics
  tokensGenerated?: number;
  estimatedTokens?: number;
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  // Image-specific token metrics
  imageTokens?: number;
  textPromptTokens?: number;
}

/** Collect stats from each chunk run for performance analysis */
export const chunkStats: GPUStats[] = [];

/** Combined GPU performance statistics */
export const gpuStats: GPUStats = {};

/** Default VLM model for image processing */
const DEFAULT_MODEL = "google/gemma-3-27b"; // Change to your preferred VLM model

/** Current model being used (from command line args or default) */
const model = Deno.args[1] || DEFAULT_MODEL;

/** LM Studio client instance for API communication */
export const client = new LMStudioClient();

/**
 * Collect GPU performance stats from LM Studio client
 *
 * @param client - The LM Studio client instance
 * @returns Promise that resolves to GPU performance statistics
 * @example
 * ```typescript
 * const stats = await collectGPUStats(client);
 * console.log(stats.tokensPerSecond);
 * ```
 */
export async function collectGPUStats(
  client: LMStudioClient,
): Promise<GPUStats> {
  try {
    // Get loaded models from LM Studio client
    const loadedModels = await client.llm.listLoaded();

    let modelInfo = {};
    if (loadedModels.length > 0) {
      const activeModel = loadedModels[0];
      modelInfo = {
        modelName: activeModel.identifier || "Unknown",
        modelSize: "Unknown size", // This info might not be directly available
      };
    }

    return {
      ...modelInfo,
      timestamp: new Date().toISOString(),
    } as GPUStats;
  } catch (error) {
    console.log(
      "Could not collect GPU stats:",
      error instanceof Error ? error.message : String(error),
    );
    return {};
  }
}

/**
 * Calculate average performance stats from all chunk runs
 *
 * @param stats - Array of GPU performance statistics from multiple chunks
 * @returns Averaged GPU performance statistics
 * @example
 * ```typescript
 * const avgStats = calculateAverageStats(chunkStats);
 * console.log(`Average tokens/sec: ${avgStats.tokensPerSecond}`);
 * ```
 */
export function calculateAverageStats(stats: GPUStats[]): GPUStats {
  if (stats.length === 0) return {};

  const totals = stats.reduce((acc, stat) => {
    if (stat.tokensPerSecond) {
      acc.tokensPerSecond = (acc.tokensPerSecond || 0) + stat.tokensPerSecond;
    }
    if (stat.timeToFirstToken) {
      acc.timeToFirstToken = (acc.timeToFirstToken || 0) +
        stat.timeToFirstToken;
    }
    if (stat.generationTime) {
      acc.generationTime = (acc.generationTime || 0) + stat.generationTime;
    }
    if (stat.totalDraftTokensCount) {
      acc.totalDraftTokensCount = (acc.totalDraftTokensCount || 0) +
        stat.totalDraftTokensCount;
    }
    if (stat.acceptedDraftTokensCount) {
      acc.acceptedDraftTokensCount = (acc.acceptedDraftTokensCount || 0) +
        stat.acceptedDraftTokensCount;
    }
    if (stat.rejectedDraftTokensCount) {
      acc.rejectedDraftTokensCount = (acc.rejectedDraftTokensCount || 0) +
        stat.rejectedDraftTokensCount;
    }
    if (stat.ignoredDraftTokensCount) {
      acc.ignoredDraftTokensCount = (acc.ignoredDraftTokensCount || 0) +
        stat.ignoredDraftTokensCount;
    }
    // Token generation metrics
    if (stat.tokensGenerated) {
      acc.tokensGenerated = (acc.tokensGenerated || 0) + stat.tokensGenerated;
    }
    if (stat.estimatedTokens) {
      acc.estimatedTokens = (acc.estimatedTokens || 0) + stat.estimatedTokens;
    }
    if (stat.completionTokens) {
      acc.completionTokens = (acc.completionTokens || 0) +
        stat.completionTokens;
    }
    if (stat.promptTokens) {
      acc.promptTokens = (acc.promptTokens || 0) + stat.promptTokens;
    }
    if (stat.totalTokens) {
      acc.totalTokens = (acc.totalTokens || 0) + stat.totalTokens;
    }
    if (stat.inputTokens) {
      acc.inputTokens = (acc.inputTokens || 0) + stat.inputTokens;
    }
    if (stat.outputTokens) {
      acc.outputTokens = (acc.outputTokens || 0) + stat.outputTokens;
    }
    if (stat.imageTokens) {
      acc.imageTokens = (acc.imageTokens || 0) + stat.imageTokens;
    }
    if (stat.textPromptTokens) {
      acc.textPromptTokens = (acc.textPromptTokens || 0) +
        stat.textPromptTokens;
    }
    return acc;
  }, {} as Record<string, number>);

  const count = stats.length;
  const averages: GPUStats = {};

  if (totals.tokensPerSecond) {
    averages.tokensPerSecond = totals.tokensPerSecond / count;
  }
  if (totals.timeToFirstToken) {
    averages.timeToFirstToken = totals.timeToFirstToken / count;
  }
  if (totals.generationTime) {
    averages.generationTime = totals.generationTime / count;
  }
  if (totals.totalDraftTokensCount) {
    averages.totalDraftTokensCount = Math.round(
      totals.totalDraftTokensCount / count,
    );
  }
  if (totals.acceptedDraftTokensCount) {
    averages.acceptedDraftTokensCount = Math.round(
      totals.acceptedDraftTokensCount / count,
    );
  }
  if (totals.rejectedDraftTokensCount) {
    averages.rejectedDraftTokensCount = Math.round(
      totals.rejectedDraftTokensCount / count,
    );
  }
  if (totals.ignoredDraftTokensCount) {
    averages.ignoredDraftTokensCount = Math.round(
      totals.ignoredDraftTokensCount / count,
    );
  }

  // Token metrics - keep totals for these, not averages
  if (totals.tokensGenerated) averages.tokensGenerated = totals.tokensGenerated;
  if (totals.estimatedTokens) averages.estimatedTokens = totals.estimatedTokens;
  if (totals.completionTokens) averages.completionTokens = totals.completionTokens;
  if (totals.promptTokens) averages.promptTokens = totals.promptTokens;
  if (totals.totalTokens) averages.totalTokens = totals.totalTokens;
  if (totals.inputTokens) averages.inputTokens = totals.inputTokens;
  if (totals.outputTokens) averages.outputTokens = totals.outputTokens;
  if (totals.imageTokens) averages.imageTokens = totals.imageTokens;
  if (totals.textPromptTokens) averages.textPromptTokens = totals.textPromptTokens;

  // Calculate average draft acceptance rate
  if (
    averages.totalDraftTokensCount && averages.totalDraftTokensCount > 0 &&
    averages.acceptedDraftTokensCount
  ) {
    averages.draftAcceptanceRate =
      (averages.acceptedDraftTokensCount / averages.totalDraftTokensCount) *
      100;
  }

  // Copy non-numeric fields from first stat
  if (stats[0]) {
    averages.modelName = stats[0].modelName;
    averages.modelSize = stats[0].modelSize;
    averages.stopReason = stats[0].stopReason;
    averages.draftModel = stats[0].draftModel;
  }

  return averages;
}

/**
 * Deduplicate and merge text from multiple chunks
 * Handles overlapping content between receipt chunks by finding common lines
 * and removing duplicates while preserving the correct order
 * 
 * @param textChunks - Array of text strings from different image chunks
 * @returns Merged and deduplicated text string
 * @example
 * ```typescript
 * const chunks = ["Line 1\nLine 2\nLine 3", "Line 2\nLine 3\nLine 4"];
 * const merged = deduplicateAndMergeText(chunks);
 * // Result: "Line 1\nLine 2\nLine 3\nLine 4"
 * ```
 */
export function deduplicateAndMergeText(textChunks: string[]): string {
  if (textChunks.length === 0) return "";
  if (textChunks.length === 1) return textChunks[0];

  // Split each chunk into lines for easier processing
  const chunkLines = textChunks.map((chunk) =>
    chunk.split("\n").map((line) => line.trim()).filter((line) =>
      line.length > 0
    )
  );

  let mergedLines: string[] = [];

  // Start with the first chunk
  mergedLines = [...chunkLines[0]];

  // Process each subsequent chunk
  for (let chunkIndex = 1; chunkIndex < chunkLines.length; chunkIndex++) {
    const currentChunk = chunkLines[chunkIndex];

    // Find the best overlap point between merged content and current chunk
    const overlapIndex = findBestOverlap(mergedLines, currentChunk);

    if (overlapIndex >= 0) {
      // Found overlap - remove duplicated lines from current chunk
      const uniqueLines = currentChunk.slice(overlapIndex);
      mergedLines.push(...uniqueLines);
    } else {
      // No overlap found - add all lines (might be a gap in the receipt)
      mergedLines.push(...currentChunk);
    }
  }

  console.log(`Deduplication complete: processed ${textChunks.length} chunks, merged to ${mergedLines.length} total lines`);
  return mergedLines.join("\n");
}

/**
 * Find the best overlap point between existing merged content and a new chunk
 * Analyzes the last few lines of merged content against the first few lines of new chunk
 * to identify where unique content starts
 * 
 * @param mergedLines - Array of lines from previously merged content
 * @param newChunkLines - Array of lines from the new chunk to merge
 * @returns Index in the new chunk where unique content starts, or -1 if no overlap found
 * @example
 * ```typescript
 * const merged = ["Line 1", "Line 2", "Line 3"];
 * const newChunk = ["Line 2", "Line 3", "Line 4"];
 * const overlapIndex = findBestOverlap(merged, newChunk);
 * // Result: 2 (unique content starts at index 2 - "Line 4")
 * ```
 */
export function findBestOverlap(
  mergedLines: string[],
  newChunkLines: string[],
): number {
  const lookbackLines = Math.min(10, mergedLines.length); // Look at last 10 lines of merged content
  const lookforwardLines = Math.min(10, newChunkLines.length); // Look at first 10 lines of new chunk

  // Get the last few lines of merged content for comparison
  const endOfMerged = mergedLines.slice(-lookbackLines);

  // Try to find matching sequences
  for (let newStart = 0; newStart < lookforwardLines; newStart++) {
    let matchLength = 0;

    // Count consecutive matching lines
    for (
      let i = 0;
      i < Math.min(endOfMerged.length, newChunkLines.length - newStart);
      i++
    ) {
      const mergedLine = endOfMerged[endOfMerged.length - 1 - i];
      const newLine = newChunkLines[newStart + i];

      if (
        normalizeLineForComparison(mergedLine) ===
          normalizeLineForComparison(newLine)
      ) {
        matchLength++;
      } else {
        break;
      }
    }

    // If we found a good match (at least 2 lines), return the position after the overlap
    if (matchLength >= 2) {
      return newStart + matchLength;
    }
  }

  // Try fuzzy matching for smaller overlaps or slight variations
  for (
    let newStart = 0;
    newStart < Math.min(5, newChunkLines.length);
    newStart++
  ) {
    const newLine = normalizeLineForComparison(newChunkLines[newStart]);

    // Check if this line appears in the last few lines of merged content
    for (
      let mergedIndex = Math.max(0, mergedLines.length - 5);
      mergedIndex < mergedLines.length;
      mergedIndex++
    ) {
      const mergedLine = normalizeLineForComparison(mergedLines[mergedIndex]);

      if (
        newLine.length > 10 && mergedLine.includes(newLine) ||
        newLine.includes(mergedLine)
      ) {
        return newStart + 1;
      }
    }
  }

  return -1; // No overlap found
}

/**
 * Normalize a line for comparison by removing extra spaces, punctuation variations, etc.
 * Used to improve matching accuracy when finding overlaps between text chunks
 * 
 * @param line - The text line to normalize
 * @returns Normalized string with standardized spacing and no punctuation
 * @example
 * ```typescript
 * const normalized = normalizeLineForComparison("  Hello, World!  ");
 * // Result: "hello world"
 * ```
 */
export function normalizeLineForComparison(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

/**
 * Display performance summary for all processed chunks
 * Shows individual chunk performance metrics and total token usage breakdown
 * 
 * @example
 * ```typescript
 * showChunkPerformanceSummary(); // Outputs performance stats to console
 * ```
 */
export function showChunkPerformanceSummary() {
  if (chunkStats.length > 1) {
    // Calculate totals
    const totalImageTokens = chunkStats.reduce(
      (sum, stat) => sum + (stat.imageTokens || 0),
      0,
    );
    const totalTextTokens = chunkStats.reduce(
      (sum, stat) => sum + (stat.textPromptTokens || 0),
      0,
    );
    const totalInputTokens = totalTextTokens + totalImageTokens;
    const totalOutputTokens = chunkStats.reduce(
      (sum, stat) => sum + (stat.outputTokens || stat.completionTokens || 0),
      0,
    );

    console.log(`Individual Chunk Performance Summary: ${chunkStats.length} chunks processed. Total tokens: ${totalInputTokens} input (${totalTextTokens} text + ${totalImageTokens} image) + ${totalOutputTokens} output = ${totalInputTokens + totalOutputTokens} total`);
  }
}

/**
 * Display comprehensive GPU performance statistics
 * Shows model information, token generation rates, timing metrics, and token usage breakdown
 * 
 * @param combinedGPUStats - Combined GPU performance statistics to display
 * @example
 * ```typescript
 * const stats = calculateAverageStats(chunkStats);
 * displayGPUStats(stats);
 * ```
 */
export function displayGPUStats(
  combinedGPUStats: {
    modelName?: string;
    modelSize?: string;
    tokensPerSecond?: number;
    timeToFirstToken?: number;
    generationTime?: number;
    stopReason?: string;
    draftModel?: string;
    totalDraftTokensCount?: number;
    acceptedDraftTokensCount?: number;
    rejectedDraftTokensCount?: number;
    ignoredDraftTokensCount?: number;
    draftAcceptanceRate?: number;
    tokensGenerated?: number;
    estimatedTokens?: number;
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    imageTokens?: number;
    textPromptTokens?: number;
  },
) {
  if (Object.keys(combinedGPUStats).length > 0) {
    // Token generation metrics with breakdown
    const imageTokens = combinedGPUStats.imageTokens || 0;
    const textTokens = combinedGPUStats.textPromptTokens || 0;
    const calculatedInputTokens = imageTokens + textTokens;
    const outputTokens = combinedGPUStats.outputTokens || combinedGPUStats.completionTokens || 0;
    const totalTokens = calculatedInputTokens + outputTokens;
    
    const tokensPerSec = combinedGPUStats.tokensPerSecond?.toFixed(2) || "N/A";
    const ttft = combinedGPUStats.timeToFirstToken ? (combinedGPUStats.timeToFirstToken * 1000).toFixed(2) + "ms" : "N/A";
    const genTime = combinedGPUStats.generationTime?.toFixed(2) + "ms" || "N/A";
    const modelName = combinedGPUStats.modelName || model;
    
    const chunkSuffix = chunkStats.length > 1 ? ` (averaged across ${chunkStats.length} chunks)` : "";
    
    console.log(`LM Studio Performance Stats${chunkSuffix}: Model: ${modelName}, ${tokensPerSec} tok/sec, ${ttft} TTFT, ${genTime} generation time. Tokens: ${calculatedInputTokens} input (${textTokens} text + ${imageTokens} image) + ${outputTokens} output = ${totalTokens} total`);
  } else {
    console.log("LM Studio Performance Stats: Unable to collect - Make sure LM Studio v0.3.10+ is running with a VLM model loaded");
  }
}

/**
 * Process and consolidate text results from multiple image chunks
 * Handles deduplication for multi-chunk images and formats final output
 * 
 * @param allResults - Array of text extraction results from different image chunks
 * @returns Final consolidated text string
 * @example
 * ```typescript
 * const results = ["chunk1 text", "chunk2 text"];
 * const finalText = processChunkedText(results);
 * ```
 */
export function processChunkedText(allResults: string[]) {
  let finalText = "";
  if (allResults.length > 1) {
    finalText = deduplicateAndMergeText(allResults);
    console.log(`FINAL CONSOLIDATED OUTPUT: ${finalText.split("\n").length} lines, ${finalText.length} characters`);
    console.log("=".repeat(50));
    console.log(finalText);
    console.log("=".repeat(50));
  } else if (allResults.length === 1) {
    finalText = allResults[0];
    console.log(`FINAL OUTPUT: ${finalText.split("\n").length} lines, ${finalText.length} characters`);
    console.log("=".repeat(50));
    console.log(finalText);
    console.log("=".repeat(50));
  } else {
    console.log("No valid text content extracted from any chunk.");
    finalText = "No readable content found";
  }
  return finalText;
}

/**
 * Process multiple image chunks through the LM Studio vision model
 * Handles image preparation, API requests, performance tracking, and result collection
 * 
 * @param imagesToProcess - Array of image file paths to process
 * @param allResults - Array to collect text extraction results (modified in place)
 * @returns Promise that resolves when all chunks are processed
 * @example
 * ```typescript
 * const images = ["chunk1.jpg", "chunk2.jpg"];
 * const results: string[] = [];
 * await processImageChunks(images, results);
 * console.log(results); // Contains extracted text from all chunks
 * ```
 */
export async function processImageChunks(
  imagesToProcess: string[],
  allResults: string[],
) {
  for (let i = 0; i < imagesToProcess.length; i++) {
    const currentImagePath = imagesToProcess[i];

    // Prepare image using LM Studio client - start timing
    const imageStart = performance.now();
    const image = await client.files.prepareImage(currentImagePath);
    timings.imageLoad += performance.now() - imageStart;

    const prompt = `
You are a receipt parser.

Extract all textual transcational information writing out put in plain text in order of appearance${
      imagesToProcess.length > 1
        ? ` (This is chunk ${i + 1} of ${imagesToProcess.length})`
        : ""
    }

IMPORTANT: If this image chunk contains mostly empty space, white background, or no readable receipt text, respond with "EMPTY_CHUNK" only.
Only extract information that is clearly visible and relevant to this receipt transaction.`;

    // Get the model handle
    const modelHandle = await client.llm.model(model);

    // Send request to LM Studio using the client - start timing
    const apiStart = performance.now();
    const prediction = modelHandle.respond([
      { role: "user", content: prompt, images: [image] },
    ], {
      maxTokens: 8192,
    });

    // Get the complete response
    const response = await prediction;
    const content = response.content;

    const apiDuration = performance.now() - apiStart;
    timings.apiRequest += apiDuration;

    // Get prediction stats from the response
    const stats = response.stats;

    // Use actual stats from LM Studio when available, fall back to estimates
    const estimatedTokensFromContent = Math.round(content.length / 4);
    const totalTokensGenerated = stats?.predictedTokensCount || estimatedTokensFromContent;

    // Use actual prompt token count from LM Studio API
    const actualPromptTokens = stats?.promptTokensCount || 0;
    
    // Calculate token breakdown using known values from LM Studio debug logs
    const estimatedTextTokens = Math.round(prompt.length / 4);
    // From LM Studio debug logs: "Evaluated 259 tokens for image [idx: 4]"
    const imageTokensPerImage = 259;
    
    // Use the actual breakdown: 
    // - Image tokens are consistently 259 per image (from debug logs)
    // - Text tokens can be calculated from total prompt tokens minus image tokens
    const actualImageTokens = imageTokensPerImage;
    const actualTextTokens = actualPromptTokens > imageTokensPerImage 
      ? actualPromptTokens - imageTokensPerImage
      : estimatedTextTokens;

    const chunkStat: GPUStats = {
      // Use actual performance metrics from LM Studio
      tokensPerSecond: stats?.tokensPerSecond,
      timeToFirstToken: stats?.timeToFirstTokenSec,
      generationTime: apiDuration,
      stopReason: stats?.stopReason,
      // Token generation metrics - prefer actual over estimated
      estimatedTokens: estimatedTokensFromContent,
      tokensGenerated: totalTokensGenerated,
      promptTokens: actualPromptTokens,
      completionTokens: stats?.predictedTokensCount || estimatedTokensFromContent,
      totalTokens: stats?.totalTokensCount,
      // Token breakdown using consistent logic
      imageTokens: actualImageTokens,
      textPromptTokens: actualTextTokens,
      inputTokens: actualPromptTokens,
      outputTokens: stats?.predictedTokensCount || estimatedTokensFromContent,
    };

    // Store stats for this chunk
    chunkStats.push(chunkStat);

    // Filter out empty or invalid chunks and provide single status log
    if (content.trim() !== "EMPTY_CHUNK" && content.trim().length > 10) {
      allResults.push(content);
      const tokensPerSec = stats?.tokensPerSecond?.toFixed(2) || "N/A";
      const ttft = stats?.timeToFirstTokenSec ? (stats.timeToFirstTokenSec * 1000).toFixed(0) + "ms" : "N/A";
      console.log(`Processed chunk ${i + 1}/${imagesToProcess.length} (${currentImagePath}): ${tokensPerSec} tok/sec, ${ttft} TTFT, ${(apiDuration / 1000).toFixed(2)}s generation, ${content.length} chars extracted`);
    } else {
      console.log(`Skipped chunk ${i + 1}/${imagesToProcess.length} (${currentImagePath}): Empty or invalid content`);
    }
  }
}
