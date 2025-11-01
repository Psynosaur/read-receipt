import {Image} from "jsr:@matmen/imagescript";

async function removeOptimalBorders(inputPath: string, outputPath: string) {
  console.log(`🎯 Starting optimal border removal for: ${inputPath}`);
  
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const { width, height } = image;
  console.log(`📏 Original dimensions: ${width}x${height}`);
  
  if (width === 0 || height === 0) {
    throw new Error("Image has zero dimensions");
  }

  function safeGetPixel(x: number, y: number): number {
    const pixelX = x + 1;
    const pixelY = y + 1;
    
    if (pixelX < 1 || pixelX > width || pixelY < 1 || pixelY > height) {
      return 0x00000000;
    }
    
    return image.getPixelAt(pixelX, pixelY);
  }
  
  // Define content detection - anything brighter than dark borders
  function isContentPixel(rgba: number): boolean {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    
    // Content threshold: anything brighter than very dark pixels
    // This captures receipt paper, text, logos, etc.
    const brightness = (r + g + b) / 3;
    return brightness > 50; // Adjust this threshold as needed
  }
  
  console.log("🔍 Finding content boundaries...");
  
  // Find the tight bounding box of all content
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  
  let contentPixelCount = 0;
  
  // Scan the entire image to find content bounds
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      
      if (isContentPixel(rgba)) {
        contentPixelCount++;
        
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    
    // Progress indicator for large images
    if (y % 200 === 0) {
      console.log(`   Scanning progress: ${((y / height) * 100).toFixed(1)}%`);
    }
  }
  
  if (maxX === -1) {
    throw new Error("No content found in image!");
  }
  
  // Add small padding to ensure we don't cut off content at edges
  const PADDING = 5;
  
  const cropLeft = Math.max(0, minX - PADDING);
  const cropTop = Math.max(0, minY - PADDING);
  const cropRight = Math.min(width - 1, maxX + PADDING);
  const cropBottom = Math.min(height - 1, maxY + PADDING);
  
  const cropWidth = cropRight - cropLeft + 1;
  const cropHeight = cropBottom - cropTop + 1;
  
  console.log(`📦 Content found:`);
  console.log(`   Content bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
  console.log(`   With padding: (${cropLeft}, ${cropTop}) to (${cropRight}, ${cropBottom})`);
  console.log(`   Final crop: ${cropWidth}x${cropHeight}`);
  
  const originalArea = width * height;
  const croppedArea = cropWidth * cropHeight;
  const contentPercentage = (contentPixelCount / originalArea) * 100;
  const retainedPercentage = (croppedArea / originalArea) * 100;
  
  console.log(`📊 Statistics:`);
  console.log(`   Content pixels: ${contentPixelCount} (${contentPercentage.toFixed(1)}% of original)`);
  console.log(`   Area retained: ${retainedPercentage.toFixed(1)}% of original`);
  console.log(`   Borders removed: top=${cropTop}, bottom=${height - 1 - cropBottom}, left=${cropLeft}, right=${width - 1 - cropRight}`);
  
  // Perform the crop
  console.log("✂️  Cropping image...");
  image.crop(cropLeft, cropTop, cropWidth, cropHeight);
  
  // Save the result
  const output = await image.encode();
  await Deno.writeFile(outputPath, output);
  
  console.log(`💾 Saved optimally cropped image to: ${outputPath}`);
  
  return {
    originalDimensions: { width, height },
    croppedDimensions: { width: cropWidth, height: cropHeight },
    contentBounds: { minX, minY, maxX, maxY },
    cropBounds: { left: cropLeft, top: cropTop, right: cropRight, bottom: cropBottom },
    bordersRemoved: { 
      top: cropTop, 
      bottom: height - 1 - cropBottom, 
      left: cropLeft, 
      right: width - 1 - cropRight 
    },
    statistics: {
      contentPixels: contentPixelCount,
      contentPercentage,
      retainedPercentage
    }
  };
}

// Test function to compare with previous method
async function compareWithPreviousMethod(inputPath: string) {
  console.log("\n🔄 Comparing optimal vs previous cropping methods...\n");
  
  // Run optimal cropping
  const optimalResult = await removeOptimalBorders(inputPath, "optimal_output.jpg");
  
  console.log("\n📊 Comparison Results:");
  console.log(`   Previous method: 1133x1514 (89.6% retained)`);
  console.log(`   Optimal method: ${optimalResult.croppedDimensions.width}x${optimalResult.croppedDimensions.height} (${optimalResult.statistics.retainedPercentage.toFixed(1)}% retained)`);
  
  const previousArea = 1133 * 1514;
  const optimalArea = optimalResult.croppedDimensions.width * optimalResult.croppedDimensions.height;
  const improvement = ((optimalArea / previousArea - 1) * 100);
  
  console.log(`   Content area improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
  console.log(`   Additional border removed: ${(89.6 - optimalResult.statistics.retainedPercentage).toFixed(1)} percentage points`);
  
  return optimalResult;
}

// Usage
if (import.meta.main) {
  try {
    const imagePath = Deno.args[0];
    if (!imagePath) {
      console.error("Error: Please provide an image file path");
      Deno.exit(1);
    }
    await compareWithPreviousMethod(imagePath);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}
