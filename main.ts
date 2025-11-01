// vision_api.ts
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding/base64";
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
            
            console.log(`📄 Response from LM Studio (${model}) - Chunk ${i + 1}:`);
            console.log(content);
            console.log(`📊 Content length: ${content.length} characters\n`);
        } else {
            console.log(`🚫 Skipping chunk ${i + 1} - Empty or invalid content`);
        }
    }

    // Combine results if multiple chunks
    if (allResults.length > 1) {
        console.log("🔗 Combined Results from All Chunks:");
        console.log("=" .repeat(50));
        allResults.forEach((result, index) => {
            console.log(`\n--- Chunk ${index + 1} ---`);
            console.log(result);
        });
        console.log("=" .repeat(50));
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