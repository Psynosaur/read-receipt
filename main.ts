// vision_api.ts
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { normalizeImage } from "./image_normalizer.ts";

// Configuration
const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const DEFAULT_MODEL = "llava"; // Change to your preferred model

// Performance metrics
const timings = {
    totalStart: performance.now(),
    imageLoad: 0,
    normalization: 0,
    apiRequest: 0,
    total: 0
};

// Get image path from command line arguments
const imagePath = Deno.args[0];
const model = Deno.args[1] || DEFAULT_MODEL;
if (!imagePath) {
    console.error("Error: Please provide an image file path");
    Deno.exit(1);
}

try {
    // Normalize image first - start timing
    const normalizationStart = performance.now();
    console.log("🎯 Normalizing image to 896x896...");

    const normalizedPath = imagePath.replace(/\.[^.]+$/, '_normalized.jpg');
    const normalizationResult = await normalizeImage(imagePath, normalizedPath, {
        method: 'chunk', // Use chunk
        jpegQuality: 85,
        applyPreprocessing: false, // Apply sharpening, contrast, and threshold
        sharpeningStrength: 1.0,
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

        // Read and encode image - start timing
        const imageStart = performance.now();
        const imageData = await Deno.readFile(currentImagePath);
        const base64Image = encodeBase64(imageData);
        const mimeType = getMimeType(currentImagePath);
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        timings.imageLoad += performance.now() - imageStart;
        const prompt = `
You are a receipt parser.

Extract all textual transcational information writing out put in plain text in order of appearance${imagesToProcess.length > 1 ? ` (This is chunk ${i + 1} of ${imagesToProcess.length})` : ''}

IMPORTANT: If this image chunk contains mostly empty space, white background, or no readable receipt text, respond with "EMPTY_CHUNK" only.
Only extract information that is clearly visible and relevant to this receipt transaction.`

        // Prepare the payload
        const payload = {
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }
            ],
            max_tokens: 8192
        };

        // Send request to LM Studio - start timing
        const apiStart = performance.now();
        const response = await fetch(LM_STUDIO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        // Handle response
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        timings.apiRequest += performance.now() - apiStart;

        const content = result.choices[0].message.content;
        
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
        allResults.forEach((result, index) => {
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
    
    // Print performance metrics
    console.log("\n📊 Performance Metrics:");
    console.log(`- Image Normalization: ${timings.normalization.toFixed(2)}ms`);
    console.log(`- Image Load & Encode: ${timings.imageLoad.toFixed(2)}ms`);
    console.log(`- API Request & Parse: ${timings.apiRequest.toFixed(2)}ms`);
    console.log(`- Total Execution Time: ${timings.total.toFixed(2)}ms`);
}

// Helper function to determine MIME type
function getMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case "png": return "image/png";
        case "jpg":
        case "jpeg": return "image/jpeg";
        case "gif": return "image/gif";
        case "webp": return "image/webp";
        case "bmp": return "image/bmp";
        default: return "application/octet-stream";
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