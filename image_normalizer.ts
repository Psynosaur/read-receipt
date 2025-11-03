import { Image } from "jsr:@matmen/imagescript";

const MIN_CHUNK_HEIHGT = 200;

/**
 * Image normalization options
 */
export interface ImageNormalizationOptions {
  /** Target width (default: 896) */
  targetWidth?: number;
  /** Target height (default: 896) */
  targetHeight?: number;
  /** Normalization method */
  method?: "letterbox" | "crop" | "stretch" | "chunk";
  /** Background color for letterboxing (RGBA format, default: white) */
  backgroundColor?: number;
  /** JPEG quality for output (1-100, default: 85) */
  jpegQuality?: number;
  /** Whether to apply preprocessing (sharpening, contrast, threshold) */
  applyPreprocessing?: boolean;
  /** Sharpening strength (default: 1.0) */
  sharpeningStrength?: number;
  /** Contrast factor (default: 1.5) */
  contrastFactor?: number;
  /** Threshold value for black/white conversion (default: 128) */
  thresholdValue?: number;
  /** Overlap between chunks in pixels (default: 50) */
  chunkOverlap?: number;
  /** Minimum height ratio to trigger chunking (default: 1.5) */
  chunkThreshold?: number;
}

/**
 * Result of image normalization
 */
export interface NormalizationResult {
  originalDimensions: { width: number; height: number };
  normalizedDimensions: { width: number; height: number };
  method: string;
  aspectRatioPreserved: boolean;
  scaleFactor: number;
  outputSize: number; // in bytes
  chunksCreated?: number;
  chunkPaths?: string[];
}

/**
 * Normalize an image to specified dimensions (default 896x896)
 *
 * @param inputPath Path to input image
 * @param outputPath Path to save normalized image
 * @param options Normalization options
 * @returns Normalization result details
 */
export async function normalizeImage(
  inputPath: string,
  outputPath: string,
  options: ImageNormalizationOptions = {},
): Promise<NormalizationResult> {
  const {
    targetWidth = 896,
    targetHeight = 896,
    method = "letterbox",
    backgroundColor = 0xFFFFFFFF, // White background
    jpegQuality = 85,
    applyPreprocessing = false,
    sharpeningStrength = 1.0,
    contrastFactor = 1.5,
    thresholdValue = 128,
    chunkOverlap = 50,
    chunkThreshold = 1.5,
  } = options;

  console.log(`Normalizing image: ${inputPath} → ${outputPath}`);
  console.log(`Target dimensions: ${targetWidth}x${targetHeight}`);
  console.log(`Method: ${method}`);

  // Load the image
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);

  const originalWidth = image.width;
  const originalHeight = image.height;

  console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);

  // Check if we need to chunk the image (for very long receipts)
  const aspectRatio = originalHeight / originalWidth;
  const shouldChunk = method === "chunk" ||
    (aspectRatio > chunkThreshold && originalHeight > targetHeight * 1.2);

  if (shouldChunk) {
    console.log(
      `Long receipt detected (aspect ratio: ${
        aspectRatio.toFixed(2)
      }), creating chunks...`,
    );
    return await normalizeWithChunking(
      image,
      inputPath,
      outputPath,
      targetWidth,
      targetHeight,
      chunkOverlap,
      jpegQuality,
      applyPreprocessing,
      { sharpeningStrength, contrastFactor, thresholdValue },
    );
  }

  let normalizedImage: Image;
  let aspectRatioPreserved = false;
  let scaleFactor = 1;

  switch (method) {
    case "letterbox":
      // Preserve aspect ratio, add padding if needed
      normalizedImage = await normalizeWithLetterbox(
        image,
        targetWidth,
        targetHeight,
        backgroundColor,
      );
      aspectRatioPreserved = true;
      scaleFactor = Math.min(
        targetWidth / originalWidth,
        targetHeight / originalHeight,
      );
      break;

    case "crop":
      // Preserve aspect ratio, crop excess if needed
      normalizedImage = await normalizeWithCrop(
        image,
        targetWidth,
        targetHeight,
      );
      aspectRatioPreserved = true;
      scaleFactor = Math.max(
        targetWidth / originalWidth,
        targetHeight / originalHeight,
      );
      break;

    case "stretch":
      // Stretch to exact dimensions, may distort aspect ratio
      normalizedImage = image.clone();
      normalizedImage.resize(targetWidth, targetHeight);
      aspectRatioPreserved = false;
      scaleFactor = Math.min(
        targetWidth / originalWidth,
        targetHeight / originalHeight,
      );
      break;

    // case 'chunk':
    //   // This case is handled above
    //   throw new Error('Chunking should have been handled earlier');

    default:
      throw new Error(`Unknown normalization method: ${method}`);
  }

  console.log(`Scale factor: ${scaleFactor.toFixed(3)}`);
  console.log(
    `Final dimensions: ${normalizedImage.width}x${normalizedImage.height}`,
  );

  // Apply preprocessing if requested
  if (applyPreprocessing) {
    console.log("Applying preprocessing...");
    await applyImagePreprocessing(normalizedImage, {
      sharpeningStrength,
      contrastFactor,
      thresholdValue,
    });
  }

  // Save the normalized image
  const output = await normalizedImage.encodeJPEG(jpegQuality);
  await Deno.writeFile(outputPath, output);

  const result: NormalizationResult = {
    originalDimensions: { width: originalWidth, height: originalHeight },
    normalizedDimensions: {
      width: normalizedImage.width,
      height: normalizedImage.height,
    },
    method,
    aspectRatioPreserved,
    scaleFactor,
    outputSize: output.length,
  };

  console.log(`Saved normalized image: ${outputPath}`);
  console.log(`Output size: ${(output.length / 1024).toFixed(1)} KB`);
  console.log(`Normalization complete!`);

  return result;
}

/**
 * Normalize image using letterbox method (preserve aspect ratio, add padding)
 */
async function normalizeWithLetterbox(
  image: Image,
  targetWidth: number,
  targetHeight: number,
  backgroundColor: number,
): Promise<Image> {
  const originalWidth = image.width;
  const originalHeight = image.height;

  // Calculate scale factor to fit within target dimensions
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate new dimensions
  const newWidth = Math.round(originalWidth * scale);
  const newHeight = Math.round(originalHeight * scale);

  console.log(`  Scaled dimensions: ${newWidth}x${newHeight}`);

  // Resize the image
  const resized = image.clone();
  resized.resize(newWidth, newHeight);

  // Create target canvas with background color
  const canvas = new Image(targetWidth, targetHeight);
  canvas.fill(backgroundColor);

  // Calculate position to center the resized image
  const offsetX = Math.round((targetWidth - newWidth) / 2);
  const offsetY = Math.round((targetHeight - newHeight) / 2);

  console.log(`  Offset: (${offsetX}, ${offsetY})`);

  // Composite the resized image onto the canvas
  canvas.composite(resized, offsetX, offsetY);

  return canvas;
}

/**
 * Normalize image using crop method (preserve aspect ratio, crop excess)
 */
async function normalizeWithCrop(
  image: Image,
  targetWidth: number,
  targetHeight: number,
): Promise<Image> {
  const originalWidth = image.width;
  const originalHeight = image.height;

  // Calculate scale factor to fill target dimensions
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;
  const scale = Math.max(scaleX, scaleY);

  // Calculate new dimensions
  const newWidth = Math.round(originalWidth * scale);
  const newHeight = Math.round(originalHeight * scale);

  console.log(`  Scaled dimensions: ${newWidth}x${newHeight}`);

  // Resize the image
  const resized = image.clone();
  resized.resize(newWidth, newHeight);

  // Calculate crop position to center the crop
  const cropX = Math.round((newWidth - targetWidth) / 2);
  const cropY = Math.round((newHeight - targetHeight) / 2);

  console.log(`  Crop position: (${cropX}, ${cropY})`);

  // Crop to target dimensions
  resized.crop(cropX, cropY, targetWidth, targetHeight);

  return resized;
}

/**
 * Apply image preprocessing (sharpening, contrast, threshold)
 */
async function applyImagePreprocessing(
  image: Image,
  options: {
    sharpeningStrength: number;
    contrastFactor: number;
    thresholdValue: number;
  },
): Promise<void> {
  const { sharpeningStrength, contrastFactor, thresholdValue } = options;

  // Apply sharpening
  if (sharpeningStrength > 0) {
    console.log(`  Applying sharpening (strength: ${sharpeningStrength})`);
    await applySharpeningFilter(image, sharpeningStrength);
  }

  // Apply contrast enhancement
  if (contrastFactor !== 1.0) {
    console.log(
      `  Applying contrast enhancement (factor: ${contrastFactor})`,
    );
    await applyContrastEnhancement(image, contrastFactor);
  }

  // Apply threshold transformation
  if (thresholdValue > 0 && thresholdValue < 255) {
    console.log(
      `  Applying threshold transformation (threshold: ${thresholdValue})`,
    );
    await applyThresholdTransformation(image, thresholdValue);
  }
}

/**
 * Apply sharpening filter using unsharp mask
 */
async function applySharpeningFilter(
  image: Image,
  strength: number,
): Promise<void> {
  const width = image.width;
  const height = image.height;

  // Create a copy for calculation
  const originalPixels: number[][] = [];
  for (let y = 0; y < height; y++) {
    originalPixels[y] = [];
    for (let x = 0; x < width; x++) {
      originalPixels[y][x] = image.getPixelAt(x + 1, y + 1);
    }
  }

  // Apply sharpening kernel
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;

      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const pixel = originalPixels[y + ky - 1][x + kx - 1];
          const weight = kernel[ky][kx];

          r += ((pixel >>> 24) & 0xFF) * weight;
          g += ((pixel >>> 16) & 0xFF) * weight;
          b += ((pixel >>> 8) & 0xFF) * weight;
        }
      }

      const originalPixel = originalPixels[y][x];
      const originalR = (originalPixel >>> 24) & 0xFF;
      const originalG = (originalPixel >>> 16) & 0xFF;
      const originalB = (originalPixel >>> 8) & 0xFF;
      const originalA = originalPixel & 0xFF;

      // Blend with original based on strength
      const finalR = Math.max(
        0,
        Math.min(255, originalR + (r - originalR) * strength),
      );
      const finalG = Math.max(
        0,
        Math.min(255, originalG + (g - originalG) * strength),
      );
      const finalB = Math.max(
        0,
        Math.min(255, originalB + (b - originalB) * strength),
      );

      const newRgba = (finalR << 24) | (finalG << 16) | (finalB << 8) |
        originalA;
      image.setPixelAt(x + 1, y + 1, newRgba);
    }
  }
}

/**
 * Apply contrast enhancement
 */
async function applyContrastEnhancement(
  image: Image,
  factor: number,
): Promise<void> {
  const width = image.width;
  const height = image.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = image.getPixelAt(x + 1, y + 1);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      const a = rgba & 0xFF;

      // Apply contrast around midpoint (128)
      const newR = Math.max(0, Math.min(255, (r - 128) * factor + 128));
      const newG = Math.max(0, Math.min(255, (g - 128) * factor + 128));
      const newB = Math.max(0, Math.min(255, (b - 128) * factor + 128));

      const newRgba = (newR << 24) | (newG << 16) | (newB << 8) | a;
      image.setPixelAt(x + 1, y + 1, newRgba);
    }
  }
}

/**
 * Apply threshold transformation (convert to black/white)
 */
async function applyThresholdTransformation(
  image: Image,
  threshold: number,
): Promise<void> {
  const width = image.width;
  const height = image.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = image.getPixelAt(x + 1, y + 1);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      const a = rgba & 0xFF;

      // Calculate brightness
      const brightness = (r + g + b) / 3;

      // Apply threshold
      const newValue = brightness >= threshold ? 255 : 0;

      const newRgba = (newValue << 24) | (newValue << 16) | (newValue << 8) | a;
      image.setPixelAt(x + 1, y + 1, newRgba);
    }
  }
}

/**
 * Normalize image by chunking into multiple 896x896 pieces with overlap
 */
async function normalizeWithChunking(
  image: Image,
  inputPath: string,
  outputPath: string,
  targetWidth: number,
  targetHeight: number,
  overlap: number,
  jpegQuality: number,
  applyPreprocessing: boolean,
  preprocessingOptions: {
    sharpeningStrength: number;
    contrastFactor: number;
    thresholdValue: number;
  },
): Promise<NormalizationResult> {
  const originalWidth = image.width;
  const originalHeight = image.height;

  // Calculate scale factor to fit width to target
  const scaleX = targetWidth / originalWidth;

  // Resize image to fit target width while preserving aspect ratio
  const scaledWidth = targetWidth;
  const scaledHeight = Math.round(originalHeight * scaleX);

  console.log(`  Scaling to: ${scaledWidth}x${scaledHeight}`);

  const scaledImage = image.clone();
  scaledImage.resize(scaledWidth, scaledHeight);

  // Calculate chunk parameters
  const chunkHeight = targetHeight - overlap; // Effective chunk height accounting for overlap
  const totalChunks = Math.ceil(scaledHeight / chunkHeight);

  console.log(`  Creating ${totalChunks} chunks with ${overlap}px overlap`);

  const chunkPaths: string[] = [];
  const baseOutputPath = outputPath.replace(/\.[^.]+$/, ""); // Remove extension
  const extension = outputPath.match(/\.[^.]+$/)?.[0] || ".jpg";

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const startY = chunkIndex * chunkHeight;
    const endY = Math.min(startY + targetHeight, scaledHeight);
    const actualChunkHeight = endY - startY;

    // Skip chunks that are too small to contain meaningful content
    const minChunkHeight = Math.min(MIN_CHUNK_HEIHGT, targetHeight * 0.3); // At least 200px or 30% of target height
    if (actualChunkHeight < minChunkHeight) {
      console.log(
        `  Skipping chunk ${
          chunkIndex + 1
        }/${totalChunks} - too small (${actualChunkHeight}px < ${minChunkHeight}px)`,
      );
      continue;
    }

    console.log(
      `  Processing chunk ${
        chunkIndex + 1
      }/${totalChunks} (y: ${startY}-${endY})`,
    );

    // Create chunk
    const chunk = scaledImage.clone();
    chunk.crop(0, startY, scaledWidth, actualChunkHeight);

    // If chunk is smaller than target height, pad it
    let finalChunk = chunk;
    if (actualChunkHeight < targetHeight) {
      const paddedChunk = new Image(targetWidth, targetHeight);
      paddedChunk.fill(0xFFFFFFFF); // White background
      paddedChunk.composite(chunk, 0, 0);
      finalChunk = paddedChunk;
    }

    // Apply preprocessing if requested
    if (applyPreprocessing) {
      console.log(`    Applying preprocessing to chunk ${chunkIndex + 1}`);
      await applyImagePreprocessing(finalChunk, preprocessingOptions);
    }

    // Generate chunk filename
    const chunkPath = `${baseOutputPath}_${chunkIndex + 1}${extension}`;

    // Save chunk
    const chunkOutput = await finalChunk.encodeJPEG(jpegQuality);
    await Deno.writeFile(chunkPath, chunkOutput);

    chunkPaths.push(chunkPath);
    console.log(
      `    Saved chunk: ${chunkPath} (${
        (chunkOutput.length / 1024).toFixed(1)
      } KB)`,
    );
  }

  // Calculate total output size
  const totalOutputSize = chunkPaths.reduce((total, path) => {
    try {
      const stat = Deno.statSync(path);
      return total + stat.size;
    } catch {
      return total;
    }
  }, 0);

  const result: NormalizationResult = {
    originalDimensions: { width: originalWidth, height: originalHeight },
    normalizedDimensions: { width: targetWidth, height: targetHeight },
    method: "chunk",
    aspectRatioPreserved: true,
    scaleFactor: scaleX,
    outputSize: totalOutputSize,
    chunksCreated: totalChunks,
    chunkPaths,
  };

  console.log(` Chunking complete! Created ${totalChunks} chunks`);
  console.log(
    ` Total output size: ${(totalOutputSize / 1024).toFixed(1)} KB`,
  );

  return result;
}

// CLI usage
if (import.meta.main) {
  const inputPath = Deno.args[0];
  const outputPath = Deno.args[1] ||
    inputPath.replace(/\.[^.]+$/, "_normalized.jpg");
  const method = (Deno.args[2] as "letterbox" | "crop" | "stretch" | "chunk") ||
    "letterbox";
  const jpegQuality = parseInt(Deno.args[3]) || 85;
  const overlap = parseInt(Deno.args[4]) || 50;

  if (!inputPath) {
    console.error(
      "Usage: deno run --allow-read --allow-write image_normalizer.ts <input> [output] [method] [quality] [overlap]",
    );
    console.error("Methods: letterbox (default), crop, stretch, chunk");
    console.error("Quality: 1-100 (default: 85)");
    console.error("Overlap: pixels for chunk overlap (default: 50)");
    Deno.exit(1);
  }

  try {
    const result = await normalizeImage(inputPath, outputPath, {
      method,
      jpegQuality,
      chunkOverlap: overlap,
    });

    if (result.chunksCreated) {
      console.log(`\n Summary: Created ${result.chunksCreated} chunks:`);
      result.chunkPaths?.forEach((path, index) => {
        console.log(`  ${index + 1}. ${path}`);
      });
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}
