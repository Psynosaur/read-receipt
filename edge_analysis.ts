import {Image} from "jsr:@matmen/imagescript";

async function analyzeEdges(inputPath: string) {
  console.log(`🔍 Analyzing edges in: ${inputPath}`);
  
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const { width, height } = image;
  console.log(`📏 Image dimensions: ${width}x${height}`);
  
  function safeGetPixel(x: number, y: number): number {
    const pixelX = x + 1;
    const pixelY = y + 1;
    
    if (pixelX < 1 || pixelX > width || pixelY < 1 || pixelY > height) {
      return 0x00000000;
    }
    
    return image.getPixelAt(pixelX, pixelY);
  }
  
  function getBrightness(rgba: number): number {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    return (r + g + b) / 3;
  }
  
  // Analyze edges systematically
  console.log("\n📊 Edge Analysis:");
  
  // Top edge analysis
  console.log("\n🔝 Top Edge (first 50 rows):");
  const topBrightness: number[] = [];
  for (let y = 0; y < Math.min(50, height); y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      rowSum += getBrightness(rgba);
    }
    const avgBrightness = rowSum / width;
    topBrightness.push(avgBrightness);
    if (y < 10 || y % 10 === 0) {
      console.log(`   Row ${y}: avg brightness = ${avgBrightness.toFixed(1)}`);
    }
  }
  
  // Bottom edge analysis
  console.log("\n🔽 Bottom Edge (last 50 rows):");
  const bottomBrightness: number[] = [];
  for (let y = Math.max(0, height - 50); y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      rowSum += getBrightness(rgba);
    }
    const avgBrightness = rowSum / width;
    bottomBrightness.push(avgBrightness);
    if (y >= height - 10 || (y - (height - 50)) % 10 === 0) {
      console.log(`   Row ${y}: avg brightness = ${avgBrightness.toFixed(1)}`);
    }
  }
  
  // Left edge analysis
  console.log("\n◀️ Left Edge (first 50 columns):");
  const leftBrightness: number[] = [];
  for (let x = 0; x < Math.min(50, width); x++) {
    let colSum = 0;
    for (let y = 0; y < height; y++) {
      const rgba = safeGetPixel(x, y);
      colSum += getBrightness(rgba);
    }
    const avgBrightness = colSum / height;
    leftBrightness.push(avgBrightness);
    if (x < 10 || x % 10 === 0) {
      console.log(`   Col ${x}: avg brightness = ${avgBrightness.toFixed(1)}`);
    }
  }
  
  // Right edge analysis
  console.log("\n▶️ Right Edge (last 50 columns):");
  const rightBrightness: number[] = [];
  for (let x = Math.max(0, width - 50); x < width; x++) {
    let colSum = 0;
    for (let y = 0; y < height; y++) {
      const rgba = safeGetPixel(x, y);
      colSum += getBrightness(rgba);
    }
    const avgBrightness = colSum / height;
    rightBrightness.push(avgBrightness);
    if (x >= width - 10 || (x - (width - 50)) % 10 === 0) {
      console.log(`   Col ${x}: avg brightness = ${avgBrightness.toFixed(1)}`);
    }
  }
  
  // Find potential crop points
  console.log("\n✂️ Potential Crop Points:");
  
  // Find where brightness significantly increases from edges
  const BRIGHTNESS_JUMP = 30; // Minimum brightness increase to consider content
  
  // Top crop
  let topCrop = 0;
  for (let i = 1; i < topBrightness.length; i++) {
    if (topBrightness[i] - topBrightness[0] > BRIGHTNESS_JUMP) {
      topCrop = i;
      break;
    }
  }
  
  // Bottom crop
  let bottomCrop = 0;
  for (let i = bottomBrightness.length - 2; i >= 0; i--) {
    if (bottomBrightness[i] - bottomBrightness[bottomBrightness.length - 1] > BRIGHTNESS_JUMP) {
      bottomCrop = bottomBrightness.length - 1 - i;
      break;
    }
  }
  
  // Left crop
  let leftCrop = 0;
  for (let i = 1; i < leftBrightness.length; i++) {
    if (leftBrightness[i] - leftBrightness[0] > BRIGHTNESS_JUMP) {
      leftCrop = i;
      break;
    }
  }
  
  // Right crop
  let rightCrop = 0;
  for (let i = rightBrightness.length - 2; i >= 0; i--) {
    if (rightBrightness[i] - rightBrightness[rightBrightness.length - 1] > BRIGHTNESS_JUMP) {
      rightCrop = rightBrightness.length - 1 - i;
      break;
    }
  }
  
  console.log(`   Top: remove ${topCrop} rows (brightness jump from ${topBrightness[0].toFixed(1)} to ${topBrightness[topCrop]?.toFixed(1) || 'N/A'})`);
  console.log(`   Bottom: remove ${bottomCrop} rows`);
  console.log(`   Left: remove ${leftCrop} columns (brightness jump from ${leftBrightness[0].toFixed(1)} to ${leftBrightness[leftCrop]?.toFixed(1) || 'N/A'})`);
  console.log(`   Right: remove ${rightCrop} columns`);
  
  const originalArea = width * height;
  const newWidth = width - leftCrop - rightCrop;
  const newHeight = height - topCrop - bottomCrop;
  const newArea = newWidth * newHeight;
  const retainedPercentage = (newArea / originalArea) * 100;
  
  console.log(`\n📊 Crop Results:`);
  console.log(`   Original: ${width}x${height}`);
  console.log(`   Cropped: ${newWidth}x${newHeight}`);
  console.log(`   Area retained: ${retainedPercentage.toFixed(1)}%`);
  
  return {
    topCrop,
    bottomCrop,
    leftCrop,
    rightCrop,
    newDimensions: { width: newWidth, height: newHeight },
    retainedPercentage
  };
}

// Usage
if (import.meta.main) {
  const imagePath = Deno.args[0];
  if (!imagePath) {
    console.error("❌ Error: Please provide an image file path");
    console.error("Usage: deno run --allow-read edge_analysis.ts <image_path>");
    Deno.exit(1);
  }
  await analyzeEdges(imagePath);
}
