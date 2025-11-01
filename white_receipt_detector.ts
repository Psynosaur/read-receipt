import {Image} from "jsr:@matmen/imagescript";

interface Point {
  x: number;
  y: number;
}

interface ReceiptBounds {
  corners: Point[];
  center: Point;
  angle: number;
  width: number;
  height: number;
}

interface RotationResult {
  angle: number;
  confidence: number;
  method: string;
}

/**
 * Detects the rotation angle of a receipt by analyzing edge gradients
 * in the white receipt area
 */
function detectRotationAngle(
  image: any,
  whiteAreaPoints: Point[],
  width: number,
  height: number
): RotationResult {
  console.log("🔄 Detecting rotation angle...");

  function safeGetPixel(x: number, y: number): number {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return 0x00000000;
    }
    return image.getPixelAt(x + 1, y + 1);
  }

  function getBrightness(rgba: number): number {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    return (r + g + b) / 3;
  }

  // Create a set of white area points for fast lookup
  const whitePointsSet = new Set(whiteAreaPoints.map(p => `${p.x},${p.y}`));

  // Calculate gradients for edge detection
  const gradients: { angle: number; magnitude: number; x: number; y: number }[] = [];

  // Sample points within the white area for gradient calculation
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(whiteAreaPoints.length) / 50));

  for (let i = 0; i < whiteAreaPoints.length; i += sampleStep) {
    const point = whiteAreaPoints[i];
    const x = point.x;
    const y = point.y;

    // Skip points near edges
    if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) continue;

    // Calculate Sobel gradients
    const gx =
      -1 * getBrightness(safeGetPixel(x - 1, y - 1)) +
      -2 * getBrightness(safeGetPixel(x - 1, y)) +
      -1 * getBrightness(safeGetPixel(x - 1, y + 1)) +
       1 * getBrightness(safeGetPixel(x + 1, y - 1)) +
       2 * getBrightness(safeGetPixel(x + 1, y)) +
       1 * getBrightness(safeGetPixel(x + 1, y + 1));

    const gy =
      -1 * getBrightness(safeGetPixel(x - 1, y - 1)) +
      -2 * getBrightness(safeGetPixel(x, y - 1)) +
      -1 * getBrightness(safeGetPixel(x + 1, y - 1)) +
       1 * getBrightness(safeGetPixel(x - 1, y + 1)) +
       2 * getBrightness(safeGetPixel(x, y + 1)) +
       1 * getBrightness(safeGetPixel(x + 1, y + 1));

    const magnitude = Math.sqrt(gx * gx + gy * gy);

    // Only consider significant edges
    if (magnitude > 10) {
      const angle = Math.atan2(gy, gx) * 180 / Math.PI;
      gradients.push({ angle, magnitude, x, y });
    }
  }

  console.log(`   Found ${gradients.length} edge gradients`);

  if (gradients.length < 10) {
    return { angle: 0, confidence: 0, method: "insufficient_edges" };
  }

  // Analyze dominant angles (looking for text lines which should be horizontal)
  // Text lines create strong horizontal edges, so we look for angles around 0°, 90°, 180°, 270°
  const angleBins: { [key: number]: number } = {};
  const binSize = 2; // degrees

  for (const grad of gradients) {
    // Normalize angle to 0-180 range (since we care about line orientation, not direction)
    let normalizedAngle = grad.angle;
    if (normalizedAngle < 0) normalizedAngle += 180;
    if (normalizedAngle >= 180) normalizedAngle -= 180;

    const bin = Math.round(normalizedAngle / binSize) * binSize;
    angleBins[bin] = (angleBins[bin] || 0) + grad.magnitude;
  }

  // Find the dominant angle
  let maxWeight = 0;
  let dominantAngle = 0;

  for (const [angleStr, weight] of Object.entries(angleBins)) {
    const angle = parseInt(angleStr);
    if (weight > maxWeight) {
      maxWeight = weight;
      dominantAngle = angle;
    }
  }

  // Convert to rotation angle needed to make text horizontal
  // If dominant edges are at angle X, we need to rotate by -X to make them horizontal
  let rotationAngle = -dominantAngle;

  // Handle angles near 180° (which represent nearly horizontal lines)
  // 178° is essentially the same as -2°, so we should treat it as such
  if (dominantAngle > 170) {
    // For angles > 170°, treat as negative small angle
    rotationAngle = -(dominantAngle - 180);
  } else if (dominantAngle < 10) {
    // For angles < 10°, treat as positive small angle
    rotationAngle = -dominantAngle;
  }

  // Normalize to -45 to +45 degree range (most receipts won't be rotated more than 45°)
  if (rotationAngle > 45) rotationAngle -= 90;
  if (rotationAngle < -45) rotationAngle += 90;

  // Additional safety check: if the calculated rotation is close to ±90°,
  // it's likely a misdetection and should be skipped
  if (Math.abs(rotationAngle) > 75) {
    console.log(`   ⚠️  Large rotation detected (${rotationAngle.toFixed(1)}°), likely misdetection - setting confidence to 0`);
    return { angle: 0, confidence: 0, method: "large_rotation_rejected" };
  }

  // Calculate confidence based on how dominant the peak is
  const totalWeight = Object.values(angleBins).reduce((sum, w) => sum + w, 0);
  const confidence = totalWeight > 0 ? maxWeight / totalWeight : 0;

  console.log(`   Dominant angle: ${dominantAngle}°, Rotation needed: ${rotationAngle}°, Confidence: ${confidence.toFixed(2)}`);

  return {
    angle: rotationAngle,
    confidence,
    method: "edge_gradient_analysis"
  };
}

interface WhiteReceiptDetectorOptions {
  inputPath: string;
  outputPath: string;
  jpegQuality?: number;
  applySharpening?: boolean;
  sharpeningStrength?: number;
  applyContrast?: boolean;
  contrastFactor?: number;
  applyThreshold?: boolean;
  thresholdValue?: number;
}

async function detectWhiteReceiptArea(options: WhiteReceiptDetectorOptions) {
  const {
    inputPath,
    outputPath,
    jpegQuality = 85,
    applySharpening = false,
    sharpeningStrength = 1.0,
    applyContrast = false,
    contrastFactor = 1.5,
    applyThreshold = false,
    thresholdValue = 128
  } = options;
  console.log(`🎯 Detecting white receipt area in: ${inputPath}`);
  
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const { width, height } = image;
  console.log(`📏 Original dimensions: ${width}x${height}`);
  
  function safeGetPixel(x: number, y: number): number {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return 0x00000000;
    }
    // ImageScript uses 1-based indexing
    return image.getPixelAt(x + 1, y + 1);
  }
  
  function getBrightness(rgba: number): number {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    return (r + g + b) / 3;
  }
  
  function isWhiteish(rgba: number): boolean {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    
    // Check if it's whitish (high brightness and low color variation)
    const brightness = (r + g + b) / 3;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const colorVariation = maxChannel - minChannel;
    
    // White/light gray areas: high brightness, low color variation
    return brightness > 120 && colorVariation < 50;
  }
  
  console.log("🔍 Finding white receipt areas...");
  
  // Create a binary mask of white areas
  const whiteMask: boolean[][] = [];
  let whitePixelCount = 0;
  
  for (let y = 0; y < height; y++) {
    whiteMask[y] = [];
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      const isWhite = isWhiteish(rgba);
      whiteMask[y][x] = isWhite;
      if (isWhite) whitePixelCount++;
    }
    
    if (y % 100 === 0) {
      console.log(`   Processing: ${((y / height) * 100).toFixed(1)}%`);
    }
  }
  
  console.log(`📊 Found ${whitePixelCount} white pixels (${((whitePixelCount / (width * height)) * 100).toFixed(1)}% of image)`);
  
  // Find the largest connected white area (likely the receipt)
  console.log("🔗 Finding largest connected white area...");
  
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  let largestArea = 0;
  let largestAreaPoints: Point[] = [];
  
  function floodFill(startX: number, startY: number): Point[] {
    const stack: Point[] = [{x: startX, y: startY}];
    const areaPoints: Point[] = [];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited[y][x] || !whiteMask[y][x]) {
        continue;
      }
      
      visited[y][x] = true;
      areaPoints.push({x, y});
      
      // Add 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({x: x + dx, y: y + dy});
        }
      }
    }
    
    return areaPoints;
  }

  // Helper function for flood fill after rotation
  function floodFillRotated(
    startX: number,
    startY: number,
    mask: boolean[][],
    visitedMask: boolean[][],
    imgWidth: number,
    imgHeight: number
  ): Point[] {
    const stack: Point[] = [{x: startX, y: startY}];
    const areaPoints: Point[] = [];

    while (stack.length > 0) {
      const {x, y} = stack.pop()!;

      if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight ||
          visitedMask[y][x] || !mask[y][x]) {
        continue;
      }

      visitedMask[y][x] = true;
      areaPoints.push({x, y});

      // Add 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({x: x + dx, y: y + dy});
        }
      }
    }

    return areaPoints;
  }

  // Find all connected components
  for (let y = 0; y < height; y += 5) { // Sample every 5 pixels for speed
    for (let x = 0; x < width; x += 5) {
      if (whiteMask[y][x] && !visited[y][x]) {
        const areaPoints = floodFill(x, y);
        if (areaPoints.length > largestArea) {
          largestArea = areaPoints.length;
          largestAreaPoints = areaPoints;
        }
      }
    }
  }
  
  console.log(`📦 Largest white area: ${largestArea} pixels`);

  if (largestAreaPoints.length === 0) {
    throw new Error("No significant white area found!");
  }

  // Detect rotation angle using the white area
  const rotationResult = detectRotationAngle(image, largestAreaPoints, width, height);

  // Apply rotation correction if confidence is high enough and angle is significant
  const MIN_CONFIDENCE = 0.02; // Lowered threshold for more sensitive detection
  const MIN_ANGLE = 2; // degrees

  if (rotationResult.confidence >= MIN_CONFIDENCE && Math.abs(rotationResult.angle) >= MIN_ANGLE) {
    console.log(`🔄 Applying rotation correction: ${rotationResult.angle.toFixed(1)}° (confidence: ${rotationResult.confidence.toFixed(2)})`);

    // Rotate the image
    image.rotate(rotationResult.angle, true);

    // After rotation, we need to recalculate the white area since coordinates have changed
    console.log("🔍 Recalculating white area after rotation...");

    const newWidth = image.width;
    const newHeight = image.height;

    // Recreate white mask for the rotated image
    const newWhiteMask: boolean[][] = [];
    let newWhitePixelCount = 0;

    for (let y = 0; y < newHeight; y++) {
      newWhiteMask[y] = [];
      for (let x = 0; x < newWidth; x++) {
        const rgba = image.getPixelAt(x + 1, y + 1);
        const isWhite = isWhiteish(rgba);
        newWhiteMask[y][x] = isWhite;
        if (isWhite) newWhitePixelCount++;
      }
    }

    // Find largest connected white area in rotated image
    const newVisited: boolean[][] = Array(newHeight).fill(null).map(() => Array(newWidth).fill(false));
    let newLargestArea = 0;
    let newLargestAreaPoints: Point[] = [];

    for (let y = 0; y < newHeight; y += 5) {
      for (let x = 0; x < newWidth; x += 5) {
        if (newWhiteMask[y][x] && !newVisited[y][x]) {
          const areaPoints = floodFillRotated(x, y, newWhiteMask, newVisited, newWidth, newHeight);
          if (areaPoints.length > newLargestArea) {
            newLargestArea = areaPoints.length;
            newLargestAreaPoints = areaPoints;
          }
        }
      }
    }

    // Update variables for the rotated image
    largestAreaPoints = newLargestAreaPoints;
    largestArea = newLargestArea;

    console.log(`   New largest white area after rotation: ${largestArea} pixels`);
  } else {
    console.log(`⏭️  Skipping rotation: angle=${rotationResult.angle.toFixed(1)}°, confidence=${rotationResult.confidence.toFixed(2)}`);
  }

  // Get current image dimensions (may have changed after rotation)
  const currentWidth = image.width;
  const currentHeight = image.height;

  // Find content boundaries within the white area for aggressive cropping
  console.log("🎯 Finding content boundaries for aggressive cropping...");

  // First get the basic bounding box of the white area
  let minX = currentWidth, maxX = 0, minY = currentHeight, maxY = 0;

  for (const point of largestAreaPoints) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  // Now find the actual content boundaries by looking for non-white pixels within the white area
  let contentMinX = maxX, contentMaxX = minX, contentMinY = maxY, contentMaxY = minY;

  // Sample the white area to find actual content (non-white pixels)
  for (const point of largestAreaPoints) {
    const x = point.x;
    const y = point.y;

    // Check if this pixel or its neighbors contain content (darker pixels)
    let hasContent = false;
    for (let dy = -1; dy <= 1 && !hasContent; dy++) {
      for (let dx = -1; dx <= 1 && !hasContent; dx++) {
        const checkX = x + dx;
        const checkY = y + dy;
        if (checkX >= 0 && checkX < currentWidth && checkY >= 0 && checkY < currentHeight) {
          const rgba = image.getPixelAt(checkX + 1, checkY + 1);
          const r = (rgba >>> 24) & 0xFF;
          const g = (rgba >>> 16) & 0xFF;
          const b = (rgba >>> 8) & 0xFF;
          const brightness = (r + g + b) / 3;
          // Consider pixels with brightness < 200 as content
          if (brightness < 200) {
            hasContent = true;
          }
        }
      }
    }

    if (hasContent) {
      contentMinX = Math.min(contentMinX, x);
      contentMaxX = Math.max(contentMaxX, x);
      contentMinY = Math.min(contentMinY, y);
      contentMaxY = Math.max(contentMaxY, y);
    }
  }

  // If we found content boundaries, use them; otherwise fall back to white area boundaries
  if (contentMinX <= contentMaxX && contentMinY <= contentMaxY) {
    console.log(`   Content boundaries: (${contentMinX}, ${contentMinY}) to (${contentMaxX}, ${contentMaxY})`);
    minX = contentMinX;
    maxX = contentMaxX;
    minY = contentMinY;
    maxY = contentMaxY;
  } else {
    console.log("   No content boundaries found, using white area boundaries");
  }

  // Add minimal padding for aggressive cropping
  const PADDING = 5; // Reduced from 20 to 5 for more aggressive cropping
  const cropLeft = Math.max(0, minX - PADDING);
  const cropTop = Math.max(0, minY - PADDING);
  const cropRight = Math.min(currentWidth - 1, maxX + PADDING);
  const cropBottom = Math.min(currentHeight - 1, maxY + PADDING);
  
  const cropWidth = cropRight - cropLeft + 1;
  const cropHeight = cropBottom - cropTop + 1;
  
  console.log(`✂️ Cropping to white receipt area:`);
  console.log(`   White area bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
  console.log(`   With padding: (${cropLeft}, ${cropTop}) to (${cropRight}, ${cropBottom})`);
  console.log(`   Final crop: ${cropWidth}x${cropHeight}`);
  
  // Perform the crop
  image.crop(cropLeft, cropTop, cropWidth, cropHeight);

  // Apply sharpening if requested (first step in processing pipeline)
  if (applySharpening) {
    console.log(`✨ Applying sharpening (strength: ${sharpeningStrength})...`);

    const finalWidth = image.width;
    const finalHeight = image.height;

    // Create a copy of the image for sharpening calculation
    const originalPixels: number[][] = [];
    for (let y = 0; y < finalHeight; y++) {
      originalPixels[y] = [];
      for (let x = 0; x < finalWidth; x++) {
        originalPixels[y][x] = image.getPixelAt(x + 1, y + 1);
      }
    }

    // Apply unsharp mask sharpening
    // Kernel for edge detection (Laplacian)
    const sharpenKernel = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]
    ];

    for (let y = 1; y < finalHeight - 1; y++) {
      for (let x = 1; x < finalWidth - 1; x++) {
        let newR = 0, newG = 0, newB = 0;

        // Apply convolution with sharpening kernel
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const rgba = originalPixels[y + ky][x + kx];
            const r = (rgba >>> 24) & 0xFF;
            const g = (rgba >>> 16) & 0xFF;
            const b = (rgba >>> 8) & 0xFF;

            const kernelValue = sharpenKernel[ky + 1][kx + 1];
            newR += r * kernelValue;
            newG += g * kernelValue;
            newB += b * kernelValue;
          }
        }

        // Get original pixel for blending
        const originalRgba = originalPixels[y][x];
        const originalR = (originalRgba >>> 24) & 0xFF;
        const originalG = (originalRgba >>> 16) & 0xFF;
        const originalB = (originalRgba >>> 8) & 0xFF;
        const originalA = originalRgba & 0xFF;

        // Blend sharpened result with original based on strength
        const blendedR = Math.max(0, Math.min(255, originalR + (newR - originalR) * sharpeningStrength));
        const blendedG = Math.max(0, Math.min(255, originalG + (newG - originalG) * sharpeningStrength));
        const blendedB = Math.max(0, Math.min(255, originalB + (newB - originalB) * sharpeningStrength));

        // Create new RGBA value
        const newRgba = (Math.round(blendedR) << 24) | (Math.round(blendedG) << 16) | (Math.round(blendedB) << 8) | originalA;

        image.setPixelAt(x + 1, y + 1, newRgba);
      }

      // Progress indicator for large images
      if (y % 50 === 0) {
        console.log(`   Sharpening progress: ${((y / finalHeight) * 100).toFixed(1)}%`);
      }
    }

    console.log("   ✅ Sharpening complete");
  }

  // Apply contrast enhancement if requested (second step in processing pipeline)
  if (applyContrast) {
    console.log(`🎨 Applying contrast enhancement (factor: ${contrastFactor})...`);

    const finalWidth = image.width;
    const finalHeight = image.height;

    // Apply contrast enhancement
    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        const rgba = image.getPixelAt(x + 1, y + 1);
        const r = (rgba >>> 24) & 0xFF;
        const g = (rgba >>> 16) & 0xFF;
        const b = (rgba >>> 8) & 0xFF;
        const a = rgba & 0xFF;

        // Apply contrast: newValue = (oldValue - 128) * factor + 128
        // This enhances contrast around the midpoint (128)
        const newR = Math.max(0, Math.min(255, (r - 128) * contrastFactor + 128));
        const newG = Math.max(0, Math.min(255, (g - 128) * contrastFactor + 128));
        const newB = Math.max(0, Math.min(255, (b - 128) * contrastFactor + 128));

        // Create new RGBA value
        const newRgba = (Math.round(newR) << 24) | (Math.round(newG) << 16) | (Math.round(newB) << 8) | a;

        image.setPixelAt(x + 1, y + 1, newRgba);
      }

      // Progress indicator for large images
      if (y % 50 === 0) {
        console.log(`   Contrast progress: ${((y / finalHeight) * 100).toFixed(1)}%`);
      }
    }

    console.log("   ✅ Contrast enhancement complete");
  }

  // Apply threshold transformation if requested (third step in processing pipeline)
  if (applyThreshold) {
    console.log(`🎨 Applying threshold transformation (threshold: ${thresholdValue})...`);

    const finalWidth = image.width;
    const finalHeight = image.height;

    // Apply threshold to make image high contrast
    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        const rgba = image.getPixelAt(x + 1, y + 1);
        const r = (rgba >>> 24) & 0xFF;
        const g = (rgba >>> 16) & 0xFF;
        const b = (rgba >>> 8) & 0xFF;
        const a = rgba & 0xFF;

        // Calculate brightness
        const brightness = (r + g + b) / 3;

        // Apply threshold: pixels above threshold become white, below become black
        const newValue = brightness >= thresholdValue ? 255 : 0;

        // Create new RGBA value (keeping original alpha)
        const newRgba = (newValue << 24) | (newValue << 16) | (newValue << 8) | a;

        image.setPixelAt(x + 1, y + 1, newRgba);
      }

      // Progress indicator for large images
      if (y % 50 === 0) {
        console.log(`   Threshold progress: ${((y / finalHeight) * 100).toFixed(1)}%`);
      }
    }

    console.log("   ✅ Threshold transformation complete");
  }

  // Save the result with compression
  // Use JPEG encoding with configurable quality for good compression while maintaining quality
  const output = await image.encodeJPEG(jpegQuality);
  await Deno.writeFile(outputPath, output);
  
  const originalArea = width * height;
  const currentArea = currentWidth * currentHeight;
  const croppedArea = cropWidth * cropHeight;
  const retainedPercentage = (croppedArea / currentArea) * 100;

  console.log(`💾 Saved white area cropped image to: ${outputPath}`);
  console.log(`📊 Area retained: ${retainedPercentage.toFixed(1)}% of current image`);
  console.log(`🗜️  JPEG quality: ${jpegQuality}% (file size: ${(output.length / 1024).toFixed(1)} KB)`);

  return {
    originalDimensions: { width, height },
    currentDimensions: { width: currentWidth, height: currentHeight },
    croppedDimensions: { width: cropWidth, height: cropHeight },
    whiteBounds: { minX, minY, maxX, maxY },
    cropBounds: { left: cropLeft, top: cropTop, right: cropRight, bottom: cropBottom },
    rotation: rotationResult,
    statistics: {
      whitePixels: whitePixelCount,
      whitePercentage: (whitePixelCount / originalArea) * 100,
      retainedPercentage,
      largestWhiteArea: largestArea
    }
  };
}

// Usage
if (import.meta.main) {
  const imagePath = Deno.args[0];
  const outputPath = Deno.args[1] || `${imagePath}_output.jpg`;
  const qualityArg = Deno.args[2];
  const sharpeningArg = Deno.args[3];
  const sharpeningStrengthArg = Deno.args[4];
  const contrastArg = Deno.args[5];
  const contrastFactorArg = Deno.args[6];
  const thresholdArg = Deno.args[7];
  const thresholdValueArg = Deno.args[8];

  const jpegQuality = qualityArg ? parseInt(qualityArg) : 85;
  const applySharpening = sharpeningArg === "true" || sharpeningArg === "1";
  const sharpeningStrength = sharpeningStrengthArg ? parseFloat(sharpeningStrengthArg) : 1.0;
  const applyContrast = contrastArg === "true" || contrastArg === "1";
  const contrastFactor = contrastFactorArg ? parseFloat(contrastFactorArg) : 1.5;
  const applyThreshold = thresholdArg === "true" || thresholdArg === "1";
  const thresholdValue = thresholdValueArg ? parseInt(thresholdValueArg) : 128;

  if (!imagePath) {
    console.error("❌ Error: Please provide an image file path");
    console.error("Usage: deno run --allow-read --allow-write white_receipt_detector.ts <input_path> [output_path] [quality] [sharpening] [sharpening_strength] [contrast] [contrast_factor] [threshold] [threshold_value]");
    console.error("  quality: JPEG quality 1-100 (default: 85)");
    console.error("  sharpening: true/false to apply sharpening (default: false)");
    console.error("  sharpening_strength: 0.1-3.0 sharpening strength (default: 1.0)");
    console.error("  contrast: true/false to apply contrast enhancement (default: false)");
    console.error("  contrast_factor: 0.1-5.0 contrast multiplier (default: 1.5)");
    console.error("  threshold: true/false to apply threshold transformation (default: false)");
    console.error("  threshold_value: 0-255 threshold value (default: 128)");
    console.error("");
    console.error("Processing order: Sharpening → Contrast → Threshold");
    console.error("");
    console.error("Examples:");
    console.error("  Basic: deno run --allow-read --allow-write white_receipt_detector.ts receipt.jpg");
    console.error("  With sharpening: deno run --allow-read --allow-write white_receipt_detector.ts receipt.jpg output.jpg 85 true 1.2");
    console.error("  Full pipeline: deno run --allow-read --allow-write white_receipt_detector.ts receipt.jpg output.jpg 85 true 1.2 true 1.8 true 140");
    console.error("  Contrast + threshold only: deno run --allow-read --allow-write white_receipt_detector.ts receipt.jpg output.jpg 85 false 1.0 true 2.0 true 128");
    Deno.exit(1);
  }

  if (jpegQuality < 1 || jpegQuality > 100) {
    console.error("❌ Error: JPEG quality must be between 1 and 100");
    Deno.exit(1);
  }

  if (sharpeningStrength < 0.1 || sharpeningStrength > 3.0) {
    console.error("❌ Error: Sharpening strength must be between 0.1 and 3.0");
    Deno.exit(1);
  }

  if (contrastFactor < 0.1 || contrastFactor > 5.0) {
    console.error("❌ Error: Contrast factor must be between 0.1 and 5.0");
    Deno.exit(1);
  }

  if (thresholdValue < 0 || thresholdValue > 255) {
    console.error("❌ Error: Threshold value must be between 0 and 255");
    Deno.exit(1);
  }

  try {
    await detectWhiteReceiptArea({
      inputPath: imagePath,
      outputPath,
      jpegQuality,
      applySharpening,
      sharpeningStrength,
      applyContrast,
      contrastFactor,
      applyThreshold,
      thresholdValue
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}
