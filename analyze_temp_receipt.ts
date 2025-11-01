import {Image} from "jsr:@matmen/imagescript";

async function analyzeImage(inputPath: string) {
  console.log(`🔍 Analyzing pixel values in: ${inputPath}`);
  
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
  
  // Sample pixels from different regions
  const samples = [
    { name: "Top-left corner (likely border)", x: 10, y: 10 },
    { name: "Top-right corner (likely border)", x: width - 10, y: 10 },
    { name: "Bottom-left corner (likely border)", x: 10, y: height - 10 },
    { name: "Bottom-right corner (likely border)", x: width - 10, y: height - 10 },
    { name: "Center (likely content)", x: Math.floor(width / 2), y: Math.floor(height / 2) },
    { name: "Left edge", x: 5, y: Math.floor(height / 2) },
    { name: "Right edge", x: width - 5, y: Math.floor(height / 2) },
    { name: "Top edge", x: Math.floor(width / 2), y: 5 },
    { name: "Bottom edge", x: Math.floor(width / 2), y: height - 5 },
  ];
  
  console.log("\n📊 Pixel Analysis:");
  for (const sample of samples) {
    const rgba = safeGetPixel(sample.x, sample.y);
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    const a = rgba & 0xFF;
    const brightness = (r + g + b) / 3;
    
    console.log(`   ${sample.name} (${sample.x}, ${sample.y}):`);
    console.log(`      RGBA: (${r}, ${g}, ${b}, ${a})`);
    console.log(`      Brightness: ${brightness.toFixed(1)}`);
    console.log(`      Current threshold (>50): ${brightness > 50 ? "CONTENT" : "BORDER"}`);
    console.log("");
  }
  
  // Analyze brightness distribution
  const brightnessHistogram: { [key: number]: number } = {};
  let totalPixels = 0;
  
  console.log("🔍 Analyzing brightness distribution...");
  
  // Sample every 10th pixel to speed up analysis
  for (let y = 0; y < height; y += 10) {
    for (let x = 0; x < width; x += 10) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      const brightness = Math.floor((r + g + b) / 3);
      
      brightnessHistogram[brightness] = (brightnessHistogram[brightness] || 0) + 1;
      totalPixels++;
    }
  }
  
  console.log("\n📈 Brightness Distribution (sampled):");
  const sortedBrightness = Object.keys(brightnessHistogram)
    .map(k => parseInt(k))
    .sort((a, b) => a - b);
  
  let cumulativePixels = 0;
  for (const brightness of sortedBrightness) {
    const count = brightnessHistogram[brightness];
    cumulativePixels += count;
    const percentage = (count / totalPixels) * 100;
    const cumulative = (cumulativePixels / totalPixels) * 100;
    
    if (count > totalPixels * 0.01) { // Only show brightness levels with >1% of pixels
      console.log(`   Brightness ${brightness}: ${count} pixels (${percentage.toFixed(1)}%, cumulative: ${cumulative.toFixed(1)}%)`);
    }
  }
  
  // Suggest thresholds
  console.log("\n💡 Threshold Suggestions:");
  
  // Find the brightness value where 10% of pixels are darker (likely borders)
  let darkPixels = 0;
  let threshold10 = 0;
  for (const brightness of sortedBrightness) {
    darkPixels += brightnessHistogram[brightness];
    if (darkPixels / totalPixels >= 0.1) {
      threshold10 = brightness;
      break;
    }
  }
  
  // Find the brightness value where 20% of pixels are darker
  darkPixels = 0;
  let threshold20 = 0;
  for (const brightness of sortedBrightness) {
    darkPixels += brightnessHistogram[brightness];
    if (darkPixels / totalPixels >= 0.2) {
      threshold20 = brightness;
      break;
    }
  }
  
  console.log(`   Current threshold: 50`);
  console.log(`   10% darkest pixels below: ${threshold10} (try this for aggressive border removal)`);
  console.log(`   20% darkest pixels below: ${threshold20} (try this for conservative border removal)`);
  console.log(`   Suggested range: ${threshold10} - ${threshold20}`);
}

// Usage
if (import.meta.main) {
  const imagePath = Deno.args[0];
  if (!imagePath) {
    console.error("❌ Error: Please provide an image file path");
    console.error("Usage: deno run --allow-read analyze_temp_receipt.ts <image_path>");
    Deno.exit(1);
  }
  await analyzeImage(imagePath);
}
