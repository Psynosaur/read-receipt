/**
 * Performance Metrics Storage Module
 * Handles storing and retrieving performance metrics for image processing operations
 */

import { countOutputTokens } from "./token_utils.ts";

export interface PerformanceMetrics {
  /** Unique identifier for this processing session */
  sessionId: string;
  /** Timestamp when processing started */
  timestamp: string;
  /** Input file information */
  inputFile: {
    /** Original file path */
    path: string;
    /** File name only */
    name: string;
    /** File size in bytes */
    sizeBytes?: number;
  };
  /** Processing configuration */
  config: {
    /** Model used for processing */
    model: string;
    /** Normalization method used */
    normalizationMethod: string;
    /** JPEG quality setting */
    jpegQuality: number;
    /** Whether preprocessing was applied */
    applyPreprocessing: boolean;
    /** Chunk overlap value */
    chunkOverlap: number;
  };
  /** Timing metrics in milliseconds */
  timings: {
    /** Image normalization time */
    imageNormalization: number;
    /** Image load and encode time */
    imageLoadEncode: number;
    /** API request and parse time (excluding model loading) */
    apiRequestParse: number;
    /** Model loading time (separate from inference) */
    modelLoading: number;
    /** Pure inference time (API request time minus model loading) */
    inferenceTime: number;
    /** Total execution time */
    totalExecution: number;
  };
  /** Chunk processing information */
  chunks: {
    /** Number of chunks processed */
    count: number;
    /** Individual chunk performance stats */
    individual: ChunkPerformance[];
  };
  /** Token usage summary */
  tokens: {
    /** Total input tokens */
    totalInput: number;
    /** Text tokens in input */
    textTokens: number;
    /** Image tokens in input */
    imageTokens: number;
    /** Total output tokens */
    totalOutput: number;
    /** Combined total tokens */
    total: number;
    /** Final output text token count (via gpt-tokenizer) */
    finalOutputTokens: number;
  };
  /** LM Studio performance statistics */
  lmStudioStats: {
    /** Model identifier */
    modelName: string;
    /** Tokens per second */
    tokensPerSecond: number;
    /** Time to first token in milliseconds */
    timeToFirstToken: number;
    /** Generation time in milliseconds */
    generationTime: number;
    /** Whether model loading was detected during this session */
    modelLoadingDetected: boolean;
    /** Model loading time in milliseconds (if detected) */
    modelLoadingTime?: number;
    /** When model loading started (ISO timestamp) */
    modelLoadingStartTime?: string;
    /** When model loading completed (ISO timestamp) */
    modelLoadingEndTime?: string;
  };
  /** Output information */
  output: {
    /** Number of lines in final output */
    lines: number;
    /** Number of characters in final output */
    characters: number;
    /** Output file path */
    filePath: string;
    /** Whether processing was successful */
    success: boolean;
  };
}

export interface ChunkPerformance {
  /** Chunk index */
  index: number;
  /** Processing time for this chunk */
  processingTime: number;
  /** Tokens generated for this chunk */
  tokensGenerated: number;
  /** Input tokens for this chunk */
  inputTokens: number;
  /** Output tokens for this chunk */
  outputTokens: number;
}

/**
 * Load existing performance metrics from JSON file
 * @returns Array of performance metrics
 */
export async function loadMetrics(): Promise<PerformanceMetrics[]> {
  try {
    const data = await Deno.readTextFile("performance_metrics.json");
    return JSON.parse(data) as PerformanceMetrics[];
  } catch (_error) {
    // File doesn't exist or is invalid, return empty array
    console.log("No existing metrics file found, starting fresh");
    return [];
  }
}

/**
 * Save performance metrics to JSON file
 * @param metrics - New metrics to add
 */
export async function saveMetrics(metrics: PerformanceMetrics): Promise<void> {
  try {
    const existingMetrics = await loadMetrics();
    existingMetrics.push(metrics);
    
    await Deno.writeTextFile(
      "performance_metrics.json",
      JSON.stringify(existingMetrics, null, 2)
    );
    
    console.log(`Performance metrics saved. Total sessions: ${existingMetrics.length}`);
  } catch (error) {
    console.error("Error saving performance metrics:", error);
  }
}

/**
 * Generate a unique session ID
 * @returns Unique session identifier
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Configuration settings for processing
 */
export interface ProcessingConfig {
  model?: string;
  method?: string;
  jpegQuality?: number;
  applyPreprocessing?: boolean;
  chunkOverlap?: number;
}

/**
 * Timing measurements during processing
 */
export interface ProcessingTimings {
  normalization?: number;
  imageLoad?: number;
  apiRequest?: number;
  total?: number;
}

/**
 * GPU/Model performance statistics
 */
export interface GPUPerformanceStats {
  modelName?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  generationTime?: number;
  processingTime?: number;
  imageTokens?: number;
  textPromptTokens?: number;
  outputTokens?: number;
  completionTokens?: number;
  /** Whether model loading was detected during this session */
  modelLoadingDetected?: boolean;
  /** Model loading time in milliseconds (if detected) */
  modelLoadingTime?: number;
  /** When model loading started (ISO timestamp) */
  modelLoadingStartTime?: string;
  /** When model loading completed (ISO timestamp) */
  modelLoadingEndTime?: string;
}

/**
 * Session data collected during processing
 */
export interface SessionData {
  sessionId: string;
  inputFilePath: string;
  config: ProcessingConfig;
  timings: ProcessingTimings;
  chunkStats: GPUPerformanceStats[];
  gpuStats: GPUPerformanceStats;
  finalText: string;
  outputFilePath: string;
  success: boolean;
}

/**
 * Create performance metrics object from processing data
 * @param sessionData - Data collected during processing
 * @returns Formatted performance metrics
 */
export async function createMetrics(sessionData: SessionData): Promise<PerformanceMetrics> {
  // Calculate token totals
  const totalImageTokens = sessionData.chunkStats.reduce(
    (sum, stat) => sum + (stat.imageTokens || 0),
    0
  );
  const totalTextTokens = sessionData.chunkStats.reduce(
    (sum, stat) => sum + (stat.textPromptTokens || 0),
    0
  );
  const totalInputTokens = totalTextTokens + totalImageTokens;
  const totalOutputTokens = sessionData.chunkStats.reduce(
    (sum, stat) => sum + (stat.outputTokens || stat.completionTokens || 0),
    0
  );

  // Create chunk performance data
  const chunkPerformance: ChunkPerformance[] = sessionData.chunkStats.map((stat, index) => ({
    index: index + 1,
    processingTime: stat.processingTime || 0,
    tokensGenerated: stat.outputTokens || stat.completionTokens || 0,
    inputTokens: (stat.imageTokens || 0) + (stat.textPromptTokens || 0),
    outputTokens: stat.outputTokens || stat.completionTokens || 0,
  }));

  const fileName = sessionData.inputFilePath.split(/[\\\/]/).pop() || "unknown";
  
  // Get file size
  let fileSize: number | undefined;
  try {
    const fileInfo = await Deno.stat(sessionData.inputFilePath);
    fileSize = fileInfo.size;
  } catch (_error) {
    // File may not exist or be accessible
    fileSize = undefined;
  }
  
  return {
    sessionId: sessionData.sessionId,
    timestamp: new Date().toISOString(),
    inputFile: {
      path: sessionData.inputFilePath,
      name: fileName,
      sizeBytes: fileSize,
    },
    config: {
      model: sessionData.config.model || "google/gemma-3-27b",
      normalizationMethod: sessionData.config.method || "chunk",
      jpegQuality: sessionData.config.jpegQuality || 85,
      applyPreprocessing: sessionData.config.applyPreprocessing || false,
      chunkOverlap: sessionData.config.chunkOverlap || 100,
    },
    timings: {
      imageNormalization: sessionData.timings.normalization || 0,
      imageLoadEncode: sessionData.timings.imageLoad || 0,
      apiRequestParse: (sessionData.timings.apiRequest || 0) + (sessionData.gpuStats.modelLoadingTime || 0), // Total API time including loading
      modelLoading: sessionData.gpuStats.modelLoadingTime || 0,
      inferenceTime: sessionData.timings.apiRequest || 0, // Pure inference time (loading already excluded)
      totalExecution: sessionData.timings.total || 0,
    },
    chunks: {
      count: sessionData.chunkStats.length,
      individual: chunkPerformance,
    },
    tokens: {
      totalInput: totalInputTokens,
      textTokens: totalTextTokens,
      imageTokens: totalImageTokens,
      totalOutput: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
      finalOutputTokens: countOutputTokens(sessionData.finalText),
    },
    lmStudioStats: {
      modelName: sessionData.gpuStats.modelName || sessionData.config.model || "Unknown",
      tokensPerSecond: sessionData.gpuStats.tokensPerSecond || 0,
      timeToFirstToken: (sessionData.gpuStats.timeToFirstToken || 0) * 1000,
      generationTime: sessionData.gpuStats.generationTime || 0,
      modelLoadingDetected: sessionData.gpuStats.modelLoadingDetected || false,
      modelLoadingTime: sessionData.gpuStats.modelLoadingTime,
      modelLoadingStartTime: sessionData.gpuStats.modelLoadingStartTime,
      modelLoadingEndTime: sessionData.gpuStats.modelLoadingEndTime,
    },
    output: {
      lines: sessionData.finalText.split("\n").length,
      characters: sessionData.finalText.length,
      filePath: sessionData.outputFilePath,
      success: sessionData.success,
    },
  };
}

/**
 * Display performance metrics summary
 * @param metrics - Metrics to display
 */
export function displayMetricsSummary(metrics: PerformanceMetrics): void {
  console.log("\nPerformance Metrics Summary:");
  console.log(`Session: ${metrics.sessionId}`);
  console.log(`File: ${metrics.inputFile.name}`);
  console.log(`Model: ${metrics.config.model}`);
  console.log(`Chunks: ${metrics.chunks.count}`);
  console.log(`Success: ${metrics.output.success ? "True" : "False"}`);
  console.log(`Output: ${metrics.output.lines} lines, ${metrics.output.characters} characters, ${metrics.tokens.finalOutputTokens} tokens`);
  
  // Show detailed timing breakdown
  console.log(`\nTiming Breakdown:`);
  console.log(`  Image Normalization: ${metrics.timings.imageNormalization.toFixed(2)}ms`);
  console.log(`  Image Load & Encode: ${metrics.timings.imageLoadEncode.toFixed(2)}ms`);
  if (metrics.timings.modelLoading > 0) {
    console.log(`  Model Loading: ${(metrics.timings.modelLoading / 1000).toFixed(2)}s (one-time cost)`);
    console.log(`  Pure Inference: ${metrics.timings.inferenceTime.toFixed(2)}ms (all chunks, excluding loading)`);
  } else {
    console.log(`  Model Loading: 0ms (already loaded)`);
    console.log(`  Pure Inference: ${metrics.timings.inferenceTime.toFixed(2)}ms (all chunks)`);
  }
  console.log(`  Total API Time: ${metrics.timings.apiRequestParse.toFixed(2)}ms (inference + model loading)`);
  console.log(`  Total Time: ${metrics.timings.totalExecution.toFixed(2)}ms`);
  
  console.log(`\nTokens: ${metrics.tokens.total} total (${metrics.tokens.totalInput} input + ${metrics.tokens.totalOutput} output)`);
  console.log(`Performance: ${metrics.lmStudioStats.tokensPerSecond.toFixed(2)} tok/sec`);
  
  // Show model loading information if detected
  if (metrics.lmStudioStats.modelLoadingDetected) {
    console.log(`Model Loading Details: ${(metrics.lmStudioStats.modelLoadingTime! / 1000).toFixed(2)}s (${metrics.lmStudioStats.modelLoadingStartTime} → ${metrics.lmStudioStats.modelLoadingEndTime})`);
  }
}

/**
 * Get metrics statistics for all sessions
 * @returns Summary statistics
 */
export async function getMetricsStatistics(): Promise<{
  totalSessions: number;
  avgProcessingTime: number;
  avgTokensPerSecond: number;
  totalTokensProcessed: number;
  successRate: number;
}> {
  const metrics = await loadMetrics();
  
  if (metrics.length === 0) {
    return {
      totalSessions: 0,
      avgProcessingTime: 0,
      avgTokensPerSecond: 0,
      totalTokensProcessed: 0,
      successRate: 0,
    };
  }

  const totalTime = metrics.reduce((sum, m) => sum + m.timings.totalExecution, 0);
  const totalTokensPerSec = metrics.reduce((sum, m) => sum + m.lmStudioStats.tokensPerSecond, 0);
  const totalTokens = metrics.reduce((sum, m) => sum + m.tokens.total, 0);
  const successCount = metrics.filter(m => m.output.success).length;

  return {
    totalSessions: metrics.length,
    avgProcessingTime: totalTime / metrics.length,
    avgTokensPerSecond: totalTokensPerSec / metrics.length,
    totalTokensProcessed: totalTokens,
    successRate: (successCount / metrics.length) * 100,
  };
}