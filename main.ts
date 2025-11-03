/**
 * Main entry point for the image parser application
 * Processes images through normalization and LM Studio vision model for text extraction
 * 
 * Usage: deno run --allow-read --allow-write --allow-net --allow-sys --allow-env main.ts <image_path> [model_name]
 * 
 * @example
 * ```bash
 * deno run --allow-read --allow-write --allow-net main.ts receipt.jpg google/gemma-3-27b
 * ```
 */

// vision_api.ts
import { normalizeImage } from "./image_normalizer.ts";
import {
  calculateAverageStats,
  chunkStats,
  client,
  collectGPUStats,
  displayGPUStats,
  gpuStats,
  processChunkedText,
  processImageChunks,
  showChunkPerformanceSummary,
  timings,
} from "./utils.ts";
import {
  createMetrics,
  displayMetricsSummary,
  generateSessionId,
  saveMetrics,
  type ProcessingConfig,
  type SessionData,
} from "./performance_metrics.ts";

/** Get image path from command line arguments */
const imagePath = Deno.args[0];
const model = Deno.args[1] || "google/gemma-3-27b";

if (!imagePath) {
  console.error("Error: Please provide an image file path");
  Deno.exit(1);
}

// Generate session ID for this processing run
const sessionId = generateSessionId();
console.log(`🔄 Starting processing session: ${sessionId}`);

// Variables to track for metrics
let finalText = "";
let outputTextPath = "";
let success = false;

// Configuration used for this run
const processingConfig: ProcessingConfig = {
  model: model,
  method: "chunk",
  jpegQuality: 85,
  applyPreprocessing: false,
  chunkOverlap: 150,
};

try {
  // Collect initial GPU stats
  const setupStart = performance.now();
  console.log("Collecting GPU performance stats...");
  const initialGPUStats = await collectGPUStats(client);
  Object.assign(gpuStats, initialGPUStats);
  const setupTime = performance.now() - setupStart;
  timings.setup = setupTime;

  // Normalize image first - start timing
  const normalizationStart = performance.now();
  console.log("Normalizing image to 896x896...");

  const normalizedPath = imagePath.replace(/\.[^.]+$/, "_normalized.jpg");
  const normalizationResult = await normalizeImage(imagePath, normalizedPath, {
    method: "chunk" as const,
    jpegQuality: processingConfig.jpegQuality || 85,
    applyPreprocessing: processingConfig.applyPreprocessing || false,
    sharpeningStrength: 1.0,
    contrastFactor: 1.5,
    thresholdValue: 128,
    chunkOverlap: processingConfig.chunkOverlap || 100,
  });

  timings.normalization = performance.now() - normalizationStart;

  // Handle chunked images
  const imagesToProcess = normalizationResult.chunksCreated
    ? normalizationResult.chunkPaths || []
    : [normalizedPath];

  console.log(`Processing ${imagesToProcess.length} image(s)...`);

  // Process each image (chunk or single normalized image)
  const allResults: string[] = [];

  await processImageChunks(imagesToProcess, allResults);

  // Process and deduplicate results (don't show full output by default)
  const textProcessingStart = performance.now();
  finalText = processChunkedText(allResults, false);
  const textProcessingTime = performance.now() - textProcessingStart;
  timings.textProcessing = textProcessingTime;

  // Optionally save the final output to a text file
  if (finalText && finalText !== "No readable content found") {
    const fileIOStart = performance.now();
    // Create datetime stamp for filename
    const now = new Date();
    const dateTime = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5); // Format: YYYY-MM-DD_HH-MM-SS
    // Sanitize model name for filename (replace forward slashes and other invalid chars)
    const sanitizedModel = model.replace(/[\/\\:*?"<>|]/g, '-');
    // Extract filename without extension
    const baseFilename = imagePath.replace(/\.[^.]+$/, '').split(/[\/\\]/).pop() || 'image';
    outputTextPath = `${imagePath.split(/[\/\\]/).slice(0, -1).join('/')}/${dateTime}_${baseFilename}_${sanitizedModel}_extracted.txt`;
    await Deno.writeTextFile(outputTextPath, finalText);
    timings.fileIO = performance.now() - fileIOStart;
    console.log(`Final text saved to: ${outputTextPath}`);
    success = true;
  }
} catch (error) {
  console.error(
    "Error:",
    error instanceof Error ? error.message : String(error),
  );
  Deno.exit(1);
} finally {
  // Calculate total time
  timings.total = performance.now() - timings.totalStart;

  // Collect final GPU stats and merge with existing data
  const finalStatsStart = performance.now();
  console.log("Calculating average performance stats from all chunks...");
  const finalGPUStats = await collectGPUStats(client);
  timings.finalStats = performance.now() - finalStatsStart;

  // Calculate average stats from all chunk runs
  const averageStats = calculateAverageStats(chunkStats);
  const combinedGPUStats = { ...gpuStats, ...finalGPUStats, ...averageStats };

  // Print performance metrics with separated inference timing
  const modelLoadingTime = combinedGPUStats.modelLoadingTime || 0;
  // timings.apiRequest now contains only pure inference time (model loading excluded)
  const pureInferenceTime = timings.apiRequest;
  const totalAPITime = pureInferenceTime + modelLoadingTime;
  
  console.log("\nPerformance Metrics:");
  console.log(`- Initial Setup: ${timings.setup.toFixed(2)}ms`);
  console.log(`- Image Normalization: ${timings.normalization.toFixed(2)}ms`);
  console.log(`- Image Load & Encode: ${timings.imageLoad.toFixed(2)}ms`);
  if (modelLoadingTime > 0) {
    console.log(`- Model Loading: ${(modelLoadingTime / 1000).toFixed(2)}s (one-time cost)`);
    console.log(`- Pure Inference: ${pureInferenceTime.toFixed(2)}ms (all chunks, excluding loading)`);
  } else {
    console.log(`- Model Loading: 0ms (already loaded)`);
    console.log(`- Pure Inference: ${pureInferenceTime.toFixed(2)}ms (all chunks)`);
  }
  console.log(`- Text Processing: ${timings.textProcessing.toFixed(2)}ms`);
  console.log(`- File I/O: ${timings.fileIO.toFixed(2)}ms`);
  console.log(`- Final Stats Collection: ${timings.finalStats.toFixed(2)}ms`);
  console.log(`- Total API Time: ${totalAPITime.toFixed(2)}ms (inference + model loading)`);
  console.log(`- Total Execution Time: ${timings.total.toFixed(2)}ms`);
  
  // Calculate and show unaccounted time
  const accountedTime = timings.setup + timings.normalization + timings.imageLoad + 
                       pureInferenceTime + timings.textProcessing + timings.fileIO + timings.finalStats;
  const unaccountedTime = timings.total - accountedTime;
  if (unaccountedTime > 5) { // Only show if significant (>5ms)
    console.log(`- Unaccounted Time: ${unaccountedTime.toFixed(2)}ms`);
  }

  // Show individual chunk performance summary
  showChunkPerformanceSummary();

  // Display GPU stats if available
  displayGPUStats(combinedGPUStats);

  // Create and save performance metrics
  console.log("\n💾 Saving performance metrics...");
  const sessionData: SessionData = {
    sessionId,
    inputFilePath: imagePath,
    config: processingConfig,
    timings: {
      normalization: timings.normalization,
      imageLoad: timings.imageLoad,
      apiRequest: timings.apiRequest,
      total: timings.total,
    },
    chunkStats,
    gpuStats: combinedGPUStats,
    finalText: finalText || "No readable content found",
    outputFilePath: outputTextPath || "",
    success,
  };

  const metrics = await createMetrics(sessionData);
  await saveMetrics(metrics);
  displayMetricsSummary(metrics);
}
