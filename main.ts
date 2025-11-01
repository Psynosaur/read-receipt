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

/** Get image path from command line arguments */
const imagePath = Deno.args[0];

if (!imagePath) {
  console.error("Error: Please provide an image file path");
  Deno.exit(1);
}

try {
  // Collect initial GPU stats
  console.log("🔧 Collecting GPU performance stats...");
  const initialGPUStats = await collectGPUStats(client);
  Object.assign(gpuStats, initialGPUStats);

  // Normalize image first - start timing
  const normalizationStart = performance.now();
  console.log("🎯 Normalizing image to 896x896...");

  const normalizedPath = imagePath.replace(/\.[^.]+$/, "_normalized.jpg");
  const normalizationResult = await normalizeImage(imagePath, normalizedPath, {
    method: "chunk", // Use chunk
    jpegQuality: 85,
    applyPreprocessing: false, // Apply sharpening, contrast, and threshold
    sharpeningStrength: 1.0, //
    contrastFactor: 1.5,
    thresholdValue: 128,
    chunkOverlap: 100, // This seems to work okay
  });

  timings.normalization = performance.now() - normalizationStart;

  // Handle chunked images
  const imagesToProcess = normalizationResult.chunksCreated
    ? normalizationResult.chunkPaths || []
    : [normalizedPath];

  console.log(`📋 Processing ${imagesToProcess.length} image(s)...`);

  // Process each image (chunk or single normalized image)
  const allResults: string[] = [];

  await processImageChunks(imagesToProcess, allResults);

  // Process and deduplicate results
  const finalText = processChunkedText(allResults);

  // Optionally save the final output to a text file
  if (finalText && finalText !== "No readable content found") {
    const outputTextPath = imagePath.replace(/\.[^.]+$/, "_extracted_text.txt");
    await Deno.writeTextFile(outputTextPath, finalText);
    console.log(`💾 Final text saved to: ${outputTextPath}`);
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
  console.log("🔧 Calculating average performance stats from all chunks...");
  const finalGPUStats = await collectGPUStats(client);

  // Calculate average stats from all chunk runs
  const averageStats = calculateAverageStats(chunkStats);
  const combinedGPUStats = { ...gpuStats, ...finalGPUStats, ...averageStats };

  // Print performance metrics
  console.log("\n📊 Performance Metrics:");
  console.log(`- Image Normalization: ${timings.normalization.toFixed(2)}ms`);
  console.log(`- Image Load & Encode: ${timings.imageLoad.toFixed(2)}ms`);
  console.log(`- API Request & Parse: ${timings.apiRequest.toFixed(2)}ms`);
  console.log(`- Total Execution Time: ${timings.total.toFixed(2)}ms`);

  // Show individual chunk performance summary
  showChunkPerformanceSummary();

  // Display GPU stats if available
  displayGPUStats(combinedGPUStats);
}
