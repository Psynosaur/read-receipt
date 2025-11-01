// vision_api.ts
import { LMStudioClient } from "@lmstudio/sdk";
import { normalizeImage } from "./image_normalizer.ts";

// Configuration
const DEFAULT_MODEL = "google/gemma-3-27b"; // Change to your preferred VLM model

// Initialize LM Studio client
const client = new LMStudioClient();

// Performance metrics
const timings = {
    totalStart: performance.now(),
    imageLoad: 0,
    normalization: 0,
    apiRequest: 0,
    total: 0
};

// GPU performance tracking - collect stats from each run
interface GPUStats {
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

// Collect stats from each chunk run
const chunkStats: GPUStats[] = [];
const gpuStats: GPUStats = {};

/**
 * Collect GPU performance stats from LM Studio client
 */
async function collectGPUStats(): Promise<GPUStats> {
    try {
        // Get loaded models from LM Studio client
        const loadedModels = await client.llm.listLoaded();
        
        let modelInfo = {};
        if (loadedModels.length > 0) {
            const activeModel = loadedModels[0];
            modelInfo = {
                modelName: activeModel.identifier || 'Unknown',
                modelSize: 'Unknown size' // This info might not be directly available
            };
        }

        return {
            ...modelInfo,
            timestamp: new Date().toISOString()
        } as GPUStats;

    } catch (error) {
        console.log("⚠️  Could not collect GPU stats:", error instanceof Error ? error.message : String(error));
        return {};
    }
}

/**
 * Estimate token breakdown for vision models
 */
function estimateTokenBreakdown(prompt: string, totalInputTokens: number): { textTokens: number; imageTokens: number } {
    // Estimate text prompt tokens (rough approximation: ~4 characters per token)
    const estimatedTextTokens = Math.round(prompt.length / 4);
    
    // Image tokens are the remainder of input tokens after text
    const imageTokens = Math.max(0, totalInputTokens - estimatedTextTokens);
    
    return {
        textTokens: estimatedTextTokens,
        imageTokens: imageTokens
    };
}

/**
 * Calculate average performance stats from all chunk runs
 */
function calculateAverageStats(stats: GPUStats[]): GPUStats {
    if (stats.length === 0) return {};
    
    const totals = stats.reduce((acc, stat) => {
        if (stat.tokensPerSecond) acc.tokensPerSecond = (acc.tokensPerSecond || 0) + stat.tokensPerSecond;
        if (stat.timeToFirstToken) acc.timeToFirstToken = (acc.timeToFirstToken || 0) + stat.timeToFirstToken;
        if (stat.generationTime) acc.generationTime = (acc.generationTime || 0) + stat.generationTime;
        if (stat.totalDraftTokensCount) acc.totalDraftTokensCount = (acc.totalDraftTokensCount || 0) + stat.totalDraftTokensCount;
        if (stat.acceptedDraftTokensCount) acc.acceptedDraftTokensCount = (acc.acceptedDraftTokensCount || 0) + stat.acceptedDraftTokensCount;
        if (stat.rejectedDraftTokensCount) acc.rejectedDraftTokensCount = (acc.rejectedDraftTokensCount || 0) + stat.rejectedDraftTokensCount;
        if (stat.ignoredDraftTokensCount) acc.ignoredDraftTokensCount = (acc.ignoredDraftTokensCount || 0) + stat.ignoredDraftTokensCount;
        // Token generation metrics
        if (stat.tokensGenerated) acc.tokensGenerated = (acc.tokensGenerated || 0) + stat.tokensGenerated;
        if (stat.estimatedTokens) acc.estimatedTokens = (acc.estimatedTokens || 0) + stat.estimatedTokens;
        if (stat.completionTokens) acc.completionTokens = (acc.completionTokens || 0) + stat.completionTokens;
        if (stat.promptTokens) acc.promptTokens = (acc.promptTokens || 0) + stat.promptTokens;
        if (stat.totalTokens) acc.totalTokens = (acc.totalTokens || 0) + stat.totalTokens;
        if (stat.inputTokens) acc.inputTokens = (acc.inputTokens || 0) + stat.inputTokens;
        if (stat.outputTokens) acc.outputTokens = (acc.outputTokens || 0) + stat.outputTokens;
        if (stat.imageTokens) acc.imageTokens = (acc.imageTokens || 0) + stat.imageTokens;
        if (stat.textPromptTokens) acc.textPromptTokens = (acc.textPromptTokens || 0) + stat.textPromptTokens;
        return acc;
    }, {} as Record<string, number>);

    const count = stats.length;
    const averages: GPUStats = {};
    
    if (totals.tokensPerSecond) averages.tokensPerSecond = totals.tokensPerSecond / count;
    if (totals.timeToFirstToken) averages.timeToFirstToken = totals.timeToFirstToken / count;
    if (totals.generationTime) averages.generationTime = totals.generationTime / count;
    if (totals.totalDraftTokensCount) averages.totalDraftTokensCount = Math.round(totals.totalDraftTokensCount / count);
    if (totals.acceptedDraftTokensCount) averages.acceptedDraftTokensCount = Math.round(totals.acceptedDraftTokensCount / count);
    if (totals.rejectedDraftTokensCount) averages.rejectedDraftTokensCount = Math.round(totals.rejectedDraftTokensCount / count);
    if (totals.ignoredDraftTokensCount) averages.ignoredDraftTokensCount = Math.round(totals.ignoredDraftTokensCount / count);
    
    // Token metrics - keep totals for these
    if (totals.tokensGenerated) averages.tokensGenerated = totals.tokensGenerated; // Total across all chunks
    if (totals.estimatedTokens) averages.estimatedTokens = totals.estimatedTokens; // Total across all chunks
    if (totals.completionTokens) averages.completionTokens = totals.completionTokens; // Total across all chunks
    if (totals.promptTokens) averages.promptTokens = totals.promptTokens; // Total across all chunks
    if (totals.totalTokens) averages.totalTokens = totals.totalTokens; // Total across all chunks
    if (totals.inputTokens) averages.inputTokens = totals.inputTokens; // Total across all chunks
    if (totals.outputTokens) averages.outputTokens = totals.outputTokens; // Total across all chunks
    if (totals.imageTokens) averages.imageTokens = totals.imageTokens; // Total across all chunks
    if (totals.textPromptTokens) averages.textPromptTokens = totals.textPromptTokens; // Total across all chunks

    // Calculate average draft acceptance rate
    if (averages.totalDraftTokensCount && averages.totalDraftTokensCount > 0 && averages.acceptedDraftTokensCount) {
        averages.draftAcceptanceRate = (averages.acceptedDraftTokensCount / averages.totalDraftTokensCount) * 100;
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

// Get image path from command line arguments
const imagePath = Deno.args[0];
const model = Deno.args[1] || DEFAULT_MODEL;
if (!imagePath) {
    console.error("Error: Please provide an image file path");
    Deno.exit(1);
}

try {
    // Collect initial GPU stats
    console.log("🔧 Collecting GPU performance stats...");
    const initialGPUStats = await collectGPUStats();
    Object.assign(gpuStats, initialGPUStats);
    
    // Normalize image first - start timing
    const normalizationStart = performance.now();
    console.log("🎯 Normalizing image to 896x896...");

    const normalizedPath = imagePath.replace(/\.[^.]+$/, '_normalized.jpg');
    const normalizationResult = await normalizeImage(imagePath, normalizedPath, {
        method: 'chunk', // Use chunk
        jpegQuality: 85,
        applyPreprocessing: false, // Apply sharpening, contrast, and threshold
        sharpeningStrength: 1.0, //
        contrastFactor: 1.5,
        thresholdValue: 128,
        chunkOverlap: 100 // This seems to work okay
    });

    timings.normalization = performance.now() - normalizationStart;

    // Handle chunked images
    const imagesToProcess = normalizationResult.chunksCreated
        ? normalizationResult.chunkPaths || []
        : [normalizedPath];

    console.log(`📋 Processing ${imagesToProcess.length} image(s)...`);

    // Process each image (chunk or single normalized image)
    const allResults: string[] = [];

    for (let i = 0; i < imagesToProcess.length; i++) {
        const currentImagePath = imagesToProcess[i];
        console.log(`\n🔍 Processing image ${i + 1}/${imagesToProcess.length}: ${currentImagePath}`);

        // Prepare image using LM Studio client - start timing
        const imageStart = performance.now();
        const image = await client.files.prepareImage(currentImagePath);
        timings.imageLoad += performance.now() - imageStart;
        
        const prompt = `
You are a receipt parser.

Extract all textual transcational information writing out put in plain text in order of appearance${imagesToProcess.length > 1 ? ` (This is chunk ${i + 1} of ${imagesToProcess.length})` : ''}

IMPORTANT: If this image chunk contains mostly empty space, white background, or no readable receipt text, respond with "EMPTY_CHUNK" only.
Only extract information that is clearly visible and relevant to this receipt transaction.`

        // Get the model handle
        const modelHandle = await client.llm.model(model);

        // Send request to LM Studio using the client - start timing
        const apiStart = performance.now();
        const prediction = modelHandle.respond([
            { role: "user", content: prompt, images: [image] }
        ], {
            maxTokens: 8192
        });

        // Get the complete response
        const response = await prediction;
        const content = response.content;
        
        const apiDuration = performance.now() - apiStart;
        timings.apiRequest += apiDuration;

        // Get prediction stats from the response
        const stats = response.stats;
        
        // Estimate tokens from content (rough approximation: ~4 characters per token)
        const estimatedTokensFromContent = Math.round(content.length / 4);
        const totalTokensGenerated = stats ? stats.predictedTokensCount : estimatedTokensFromContent;
        
        // Estimate token breakdown between text prompt and image (rough approximation)
        const estimatedTextTokens = Math.round(prompt.length / 4);
        const promptTokens = stats?.promptTokensCount || (estimatedTextTokens + 1024);
        const estimatedImageTokens = Math.max(0, promptTokens - estimatedTextTokens);
        
        const chunkStat: GPUStats = {
            tokensPerSecond: stats ? stats.tokensPerSecond : undefined,
            timeToFirstToken: stats ? stats.timeToFirstTokenSec : undefined,
            generationTime: apiDuration,
            stopReason: stats ? stats.stopReason : undefined,
            // Token generation metrics
            estimatedTokens: estimatedTokensFromContent,
            tokensGenerated: totalTokensGenerated || 0,
            promptTokens: stats ? stats.promptTokensCount : estimatedTextTokens + estimatedImageTokens,
            completionTokens: stats ? stats.predictedTokensCount : estimatedTokensFromContent,
            totalTokens: stats ? stats.totalTokensCount : undefined,
            // Image-specific token breakdown (estimates)
            imageTokens: estimatedImageTokens,
            textPromptTokens: estimatedTextTokens
        };

        // Store stats for this chunk
        chunkStats.push(chunkStat);
        
        // Log individual chunk performance
        const tokensPerSec = stats?.tokensPerSecond ? stats.tokensPerSecond.toFixed(2) : 'N/A';
        const ttft = stats?.timeToFirstTokenSec ? (stats.timeToFirstTokenSec * 1000).toFixed(0) + 'ms' : 'N/A';
        console.log(`⚡ Chunk ${i + 1} Performance: ${tokensPerSec} tok/sec, ${ttft} TTFT`);
        console.log(`   🎯 Tokens: ~${estimatedTextTokens} text + ~${estimatedImageTokens} image, ${totalTokensGenerated || 0} generated`);
        console.log(`   ⏱️  Generation time: ${(apiDuration / 1000).toFixed(2)}s`);
        if (stats) {
            console.log(`   📊 LM Studio Stats: ${stats.promptTokensCount || 'N/A'} prompt, ${stats.predictedTokensCount || 'N/A'} completion, ${stats.totalTokensCount || 'N/A'} total`);
        }
        
        // Filter out empty or invalid chunks
        if (content.trim() !== "EMPTY_CHUNK" && content.trim().length > 10) {
            allResults.push(content);
            
            // console.log(`📄 Response from LM Studio (${model}) - Chunk ${i + 1}:`);
            // console.log(content);
            console.log(`📊 Content length: ${content.length} characters\n`);
        } else {
            console.log(`🚫 Skipping chunk ${i + 1} - Empty or invalid content`);
        }
    }

    // Process and deduplicate results
    let finalText = "";
    if (allResults.length > 1) {
        console.log("🔗 Processing and deduplicating results from all chunks...");
        finalText = deduplicateAndMergeText(allResults);
        
        console.log("\n📋 Individual Chunk Results:");
        console.log("=" .repeat(50));
        allResults.forEach((_result, index) => {
            console.log(`\n--- Chunk ${index + 1} ---`);
            // console.log(result);
        });
        console.log("=" .repeat(50));
        
        console.log("\n🎯 FINAL CONSOLIDATED OUTPUT:");
        console.log("=" .repeat(50));
        console.log(finalText);
        console.log("=" .repeat(50));
        console.log(`📊 Final output: ${finalText.split('\n').length} lines, ${finalText.length} characters`);
    } else if (allResults.length === 1) {
        finalText = allResults[0];
        console.log("\n🎯 FINAL OUTPUT:");
        console.log("=" .repeat(50));
        console.log(finalText);
        console.log("=" .repeat(50));
        console.log(`📊 Output: ${finalText.split('\n').length} lines, ${finalText.length} characters`);
    } else {
        console.log("⚠️ No valid text content extracted from any chunk.");
        finalText = "No readable content found";
    }

    // Optionally save the final output to a text file
    if (finalText && finalText !== "No readable content found") {
        const outputTextPath = imagePath.replace(/\.[^.]+$/, '_extracted_text.txt');
        await Deno.writeTextFile(outputTextPath, finalText);
        console.log(`💾 Final text saved to: ${outputTextPath}`);
    }

} catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
} finally {
    // Calculate total time
    timings.total = performance.now() - timings.totalStart;
    
    // Collect final GPU stats and merge with existing data
    console.log("🔧 Calculating average performance stats from all chunks...");
    const finalGPUStats = await collectGPUStats();
    
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
    if (chunkStats.length > 1) {
        console.log(`\n⚡ Individual Chunk Performance Summary:`);
        chunkStats.forEach((stat, index) => {
            if (stat.tokensPerSecond && stat.timeToFirstToken) {
                const inputTokens = stat.inputTokens || stat.promptTokens || 0;
                const outputTokens = stat.outputTokens || stat.completionTokens || stat.estimatedTokens || 0;
                const imageTokens = stat.imageTokens || 0;
                const textTokens = stat.textPromptTokens || 0;
                console.log(`- Chunk ${index + 1}: ${stat.tokensPerSecond.toFixed(2)} tok/sec, ${(stat.timeToFirstToken * 1000).toFixed(0)}ms TTFT`);
                console.log(`  ${textTokens} text + ${imageTokens} image = ${inputTokens} in, ${outputTokens} out tokens`);
            }
        });
        
        // Show total tokens generated with breakdown
        const totalInputTokens = chunkStats.reduce((sum, stat) => sum + (stat.inputTokens || stat.promptTokens || 0), 0);
        const totalOutputTokens = chunkStats.reduce((sum, stat) => sum + (stat.outputTokens || stat.completionTokens || stat.estimatedTokens || 0), 0);
        const totalImageTokens = chunkStats.reduce((sum, stat) => sum + (stat.imageTokens || 0), 0);
        const totalTextTokens = chunkStats.reduce((sum, stat) => sum + (stat.textPromptTokens || 0), 0);
        
        if (totalOutputTokens > 0) {
            console.log(`\n📊 Total Token Usage Breakdown:`);
            console.log(`- Text Prompts: ${totalTextTokens} tokens`);
            console.log(`- Images: ${totalImageTokens} tokens`);
            console.log(`- Input Total: ${totalInputTokens} tokens`);
            console.log(`- Output Total: ${totalOutputTokens} tokens`);
            console.log(`- Grand Total: ${totalInputTokens + totalOutputTokens} tokens across ${chunkStats.length} chunks`);
        }
    }
    
    // Display GPU stats if available
    if (Object.keys(combinedGPUStats).length > 0) {
        console.log(`\n🎮 LM Studio Performance Stats${chunkStats.length > 1 ? ' (Averaged across ' + chunkStats.length + ' chunks)' : ''}:`);
        if (combinedGPUStats.modelName) {
            console.log(`- Model: ${combinedGPUStats.modelName}`);
        }
        if (combinedGPUStats.modelSize) {
            console.log(`- Model Size: ${combinedGPUStats.modelSize}`);
        }
        if (combinedGPUStats.tokensPerSecond) {
            console.log(`- Average Tokens/Second: ${combinedGPUStats.tokensPerSecond.toFixed(2)} tok/sec`);
        }
        if (combinedGPUStats.timeToFirstToken) {
            console.log(`- Average Time to First Token: ${(combinedGPUStats.timeToFirstToken * 1000).toFixed(2)}ms`);
        }
        if (combinedGPUStats.generationTime) {
            console.log(`- Average Generation Time: ${(combinedGPUStats.generationTime * 1000).toFixed(2)}ms`);
        }
        
        // Token generation metrics with breakdown
        if (combinedGPUStats.inputTokens || combinedGPUStats.outputTokens) {
            const inputTokens = combinedGPUStats.inputTokens || combinedGPUStats.promptTokens || 0;
            const outputTokens = combinedGPUStats.outputTokens || combinedGPUStats.completionTokens || combinedGPUStats.tokensGenerated || 0;
            const totalTokens = inputTokens + outputTokens;
            
            console.log(`- Token Usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total tokens`);
            
            // Show image vs text breakdown if available
            if (combinedGPUStats.imageTokens || combinedGPUStats.textPromptTokens) {
                const imageTokens = combinedGPUStats.imageTokens || 0;
                const textTokens = combinedGPUStats.textPromptTokens || 0;
                console.log(`- Input Breakdown: ${textTokens} text prompt + ${imageTokens} image tokens`);
            }
        } else if (combinedGPUStats.tokensGenerated || combinedGPUStats.estimatedTokens) {
            const totalTokens = combinedGPUStats.tokensGenerated || combinedGPUStats.estimatedTokens || 0;
            const tokenType = combinedGPUStats.tokensGenerated ? 'actual' : 'estimated';
            console.log(`- Total Tokens Generated: ${totalTokens} tokens (${tokenType})`);
        }
        
        // Additional token details if available
        if (combinedGPUStats.completionTokens && !combinedGPUStats.outputTokens) {
            console.log(`- Completion Tokens: ${combinedGPUStats.completionTokens}`);
        }
        if (combinedGPUStats.promptTokens && !combinedGPUStats.inputTokens) {
            console.log(`- Prompt Tokens: ${combinedGPUStats.promptTokens}`);
        }
        if (combinedGPUStats.totalTokens) {
            console.log(`- Total API Tokens: ${combinedGPUStats.totalTokens} (via API usage field)`);
        }
        
        if (combinedGPUStats.draftModel) {
            console.log(`- Draft Model: ${combinedGPUStats.draftModel}`);
            console.log(`- Speculative Decoding Stats (Averaged):`);
            if (combinedGPUStats.totalDraftTokensCount) {
                console.log(`  • Avg Total Draft Tokens: ${combinedGPUStats.totalDraftTokensCount}`);
            }
            if (combinedGPUStats.acceptedDraftTokensCount !== undefined) {
                console.log(`  • Avg Accepted Draft Tokens: ${combinedGPUStats.acceptedDraftTokensCount}`);
            }
            if (combinedGPUStats.rejectedDraftTokensCount !== undefined) {
                console.log(`  • Avg Rejected Draft Tokens: ${combinedGPUStats.rejectedDraftTokensCount}`);
            }
            if (combinedGPUStats.draftAcceptanceRate !== undefined) {
                console.log(`  • Avg Draft Acceptance Rate: ${combinedGPUStats.draftAcceptanceRate.toFixed(1)}%`);
            }
        }
        if (combinedGPUStats.stopReason) {
            console.log(`- Stop Reason: ${combinedGPUStats.stopReason}`);
        }
        
        // Display any other stats we collected
        Object.entries(combinedGPUStats).forEach(([key, value]) => {
            const knownKeys = ['modelName', 'modelSize', 'tokensPerSecond', 'timeToFirstToken', 'generationTime', 
                             'stopReason', 'draftModel', 'totalDraftTokensCount', 'acceptedDraftTokensCount', 
                             'rejectedDraftTokensCount', 'ignoredDraftTokensCount', 'draftAcceptanceRate', 'timestamp',
                             'tokensGenerated', 'estimatedTokens', 'completionTokens', 'promptTokens', 'totalTokens',
                             'inputTokens', 'outputTokens', 'imageTokens', 'textPromptTokens'];
            if (!knownKeys.includes(key)) {
                console.log(`- ${key}: ${value}`);
            }
        });
    } else {
        console.log("\n🎮 LM Studio Performance Stats: Unable to collect");
        console.log("   Note: Make sure LM Studio v0.3.10+ is running with a VLM model loaded");
    }
}

/**
 * Deduplicate and merge text from multiple chunks
 * Handles overlapping content between receipt chunks
 */
function deduplicateAndMergeText(textChunks: string[]): string {
    if (textChunks.length === 0) return "";
    if (textChunks.length === 1) return textChunks[0];

    console.log("🔄 Deduplicating overlapping text between chunks...");

    // Split each chunk into lines for easier processing
    const chunkLines = textChunks.map(chunk => 
        chunk.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    );

    let mergedLines: string[] = [];
    
    // Start with the first chunk
    mergedLines = [...chunkLines[0]];
    console.log(`  ✅ Added ${chunkLines[0].length} lines from chunk 1`);

    // Process each subsequent chunk
    for (let chunkIndex = 1; chunkIndex < chunkLines.length; chunkIndex++) {
        const currentChunk = chunkLines[chunkIndex];
        console.log(`  🔍 Processing chunk ${chunkIndex + 1} with ${currentChunk.length} lines...`);

        // Find the best overlap point between merged content and current chunk
        const overlapIndex = findBestOverlap(mergedLines, currentChunk);
        
        if (overlapIndex >= 0) {
            // Found overlap - remove duplicated lines from current chunk
            const uniqueLines = currentChunk.slice(overlapIndex);
            console.log(`    📌 Found overlap at position ${overlapIndex}, adding ${uniqueLines.length} unique lines`);
            mergedLines.push(...uniqueLines);
        } else {
            // No overlap found - add all lines (might be a gap in the receipt)
            console.log(`    ➕ No overlap found, adding all ${currentChunk.length} lines`);
            mergedLines.push(...currentChunk);
        }
    }

    console.log(`✅ Deduplication complete: ${mergedLines.length} total lines`);
    return mergedLines.join('\n');
}

/**
 * Find the best overlap point between existing merged content and a new chunk
 * Returns the index in the new chunk where unique content starts
 */
function findBestOverlap(mergedLines: string[], newChunkLines: string[]): number {
    const lookbackLines = Math.min(10, mergedLines.length); // Look at last 10 lines of merged content
    const lookforwardLines = Math.min(10, newChunkLines.length); // Look at first 10 lines of new chunk
    
    // Get the last few lines of merged content for comparison
    const endOfMerged = mergedLines.slice(-lookbackLines);
    
    // Try to find matching sequences
    for (let newStart = 0; newStart < lookforwardLines; newStart++) {
        let matchLength = 0;
        
        // Count consecutive matching lines
        for (let i = 0; i < Math.min(endOfMerged.length, newChunkLines.length - newStart); i++) {
            const mergedLine = endOfMerged[endOfMerged.length - 1 - i];
            const newLine = newChunkLines[newStart + i];
            
            if (normalizeLineForComparison(mergedLine) === normalizeLineForComparison(newLine)) {
                matchLength++;
            } else {
                break;
            }
        }
        
        // If we found a good match (at least 2 lines), return the position after the overlap
        if (matchLength >= 2) {
            console.log(`    🎯 Found ${matchLength} matching lines starting at position ${newStart}`);
            return newStart + matchLength;
        }
    }
    
    // Try fuzzy matching for smaller overlaps or slight variations
    for (let newStart = 0; newStart < Math.min(5, newChunkLines.length); newStart++) {
        const newLine = normalizeLineForComparison(newChunkLines[newStart]);
        
        // Check if this line appears in the last few lines of merged content
        for (let mergedIndex = Math.max(0, mergedLines.length - 5); mergedIndex < mergedLines.length; mergedIndex++) {
            const mergedLine = normalizeLineForComparison(mergedLines[mergedIndex]);
            
            if (newLine.length > 10 && mergedLine.includes(newLine) || newLine.includes(mergedLine)) {
                console.log(`    🔍 Found fuzzy match at position ${newStart}`);
                return newStart + 1;
            }
        }
    }
    
    return -1; // No overlap found
}

/**
 * Normalize a line for comparison by removing extra spaces, punctuation variations, etc.
 */
function normalizeLineForComparison(line: string): string {
    return line
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')    // Normalize spaces
        .trim();
}