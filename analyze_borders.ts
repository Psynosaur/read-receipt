import {Image} from "jsr:@matmen/imagescript";

async function analyzeBorders(imagePath: string) {
  console.log(`🔍 Analyzing borders in: ${imagePath}`);
  
  const imageData = await Deno.readFile(imagePath);
  const image = await Image.decode(imageData);
  
  const { width, height } = image;
  console.log(`📏 Image dimensions: ${width}x${height}`);
  
  // Helper function to safely get pixel with boundary checks
  function safeGetPixel(x: number, y: number): number {
    const pixelX = x + 1;
    const pixelY = y + 1;
    
    if (pixelX < 1 || pixelX > width || pixelY < 1 || pixelY > height) {
      return 0xFFFFFFFF;
    }
    
    return image.getPixelAt(pixelX, pixelY);
  }
  
  // Analyze top edge
  console.log("\n🔝 Top edge analysis (first 10 rows):");
  for (let y = 0; y < Math.min(10, height); y++) {
    let whitePixels = 0;
    let totalPixels = 0;
    let samplePixels = [];
    
    for (let x = 0; x < width; x += Math.floor(width / 10)) { // Sample every 10th of width
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      samplePixels.push(`RGB(${r},${g},${b})`);
      
      if (r > 230 && g > 230 && b > 230) {
        whitePixels++;
      }
      totalPixels++;
    }
    
    const whitePercentage = (whitePixels / totalPixels * 100).toFixed(1);
    console.log(`  Row ${y}: ${whitePercentage}% white | Samples: ${samplePixels.join(', ')}`);
  }
  
  // Analyze bottom edge
  console.log("\n🔽 Bottom edge analysis (last 10 rows):");
  for (let y = Math.max(0, height - 10); y < height; y++) {
    let whitePixels = 0;
    let totalPixels = 0;
    let samplePixels = [];
    
    for (let x = 0; x < width; x += Math.floor(width / 10)) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      samplePixels.push(`RGB(${r},${g},${b})`);
      
      if (r > 230 && g > 230 && b > 230) {
        whitePixels++;
      }
      totalPixels++;
    }
    
    const whitePercentage = (whitePixels / totalPixels * 100).toFixed(1);
    console.log(`  Row ${y}: ${whitePercentage}% white | Samples: ${samplePixels.join(', ')}`);
  }
  
  // Analyze left edge
  console.log("\n⬅️ Left edge analysis (first 10 columns):");
  for (let x = 0; x < Math.min(10, width); x++) {
    let whitePixels = 0;
    let totalPixels = 0;
    let samplePixels = [];
    
    for (let y = 0; y < height; y += Math.floor(height / 10)) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      samplePixels.push(`RGB(${r},${g},${b})`);
      
      if (r > 230 && g > 230 && b > 230) {
        whitePixels++;
      }
      totalPixels++;
    }
    
    const whitePercentage = (whitePixels / totalPixels * 100).toFixed(1);
    console.log(`  Col ${x}: ${whitePercentage}% white | Samples: ${samplePixels.slice(0, 3).join(', ')}...`);
  }
  
  // Analyze right edge
  console.log("\n➡️ Right edge analysis (last 10 columns):");
  for (let x = Math.max(0, width - 10); x < width; x++) {
    let whitePixels = 0;
    let totalPixels = 0;
    let samplePixels = [];
    
    for (let y = 0; y < height; y += Math.floor(height / 10)) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      samplePixels.push(`RGB(${r},${g},${b})`);
      
      if (r > 230 && g > 230 && b > 230) {
        whitePixels++;
      }
      totalPixels++;
    }
    
    const whitePercentage = (whitePixels / totalPixels * 100).toFixed(1);
    console.log(`  Col ${x}: ${whitePercentage}% white | Samples: ${samplePixels.slice(0, 3).join(', ')}...`);
  }
  
  console.log("\n📊 Analysis complete!");
  console.log("💡 If you see low white percentages, the image may not have significant white borders.");
  console.log("💡 If you see high white percentages but borders weren't removed, try lowering WHITE_THRESHOLD or PIXEL_TOLERANCE.");
}

// Run the analysis
if (import.meta.main) {
  await analyzeBorders("SPAR.jpg");
}
