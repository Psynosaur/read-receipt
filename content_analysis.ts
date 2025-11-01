import {Image} from "jsr:@matmen/imagescript";

async function analyzeReceiptContent(imagePath: string) {
  console.log(`🔍 Analyzing receipt content in: ${imagePath}`);
  
  const imageData = await Deno.readFile(imagePath);
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
  
  // Define what constitutes "content" vs "border"
  function isContentPixel(rgba: number): boolean {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    
    // Content is anything that's not very dark (receipt paper, text, etc.)
    // Dark pixels (< 50) are likely black border
    const brightness = (r + g + b) / 3;
    return brightness > 50;
  }
  
  // Find the bounding box of all content pixels
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  
  let totalContentPixels = 0;
  let totalPixels = width * height;
  
  console.log("🔍 Scanning for content pixels...");
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      
      if (isContentPixel(rgba)) {
        totalContentPixels++;
        
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    
    // Progress indicator
    if (y % 100 === 0) {
      console.log(`   Progress: ${((y / height) * 100).toFixed(1)}%`);
    }
  }
  
  console.log(`✅ Analysis complete!`);
  console.log(`📊 Content pixels: ${totalContentPixels} / ${totalPixels} (${(totalContentPixels/totalPixels*100).toFixed(1)}%)`);
  
  if (maxX === -1) {
    console.log("❌ No content found!");
    return null;
  }
  
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  
  console.log(`📦 Content bounding box:`);
  console.log(`   Top-left: (${minX}, ${minY})`);
  console.log(`   Bottom-right: (${maxX}, ${maxY})`);
  console.log(`   Content size: ${contentWidth}x${contentHeight}`);
  console.log(`   Content area: ${(contentWidth * contentHeight / totalPixels * 100).toFixed(1)}% of image`);
  
  // Calculate how much border we could remove
  const borderTop = minY;
  const borderBottom = height - 1 - maxY;
  const borderLeft = minX;
  const borderRight = width - 1 - maxX;
  
  console.log(`🔲 Removable borders:`);
  console.log(`   Top: ${borderTop} pixels`);
  console.log(`   Bottom: ${borderBottom} pixels`);
  console.log(`   Left: ${borderLeft} pixels`);
  console.log(`   Right: ${borderRight} pixels`);
  
  // Compare with current smart cropping
  console.log(`\n📊 Comparison with current smart cropping:`);
  console.log(`   Current removes: top=86, left=64, bottom=0, right=0`);
  console.log(`   Optimal would be: top=${borderTop}, left=${borderLeft}, bottom=${borderBottom}, right=${borderRight}`);
  console.log(`   Additional savings possible: ${(borderTop - 86) + (borderLeft - 64) + borderBottom + borderRight} pixels`);
  
  return {
    contentBounds: { minX, minY, maxX, maxY },
    contentDimensions: { width: contentWidth, height: contentHeight },
    removableBorders: { top: borderTop, bottom: borderBottom, left: borderLeft, right: borderRight },
    contentPercentage: totalContentPixels / totalPixels * 100
  };
}

// Run the analysis
if (import.meta.main) {
  await analyzeReceiptContent("SPAR.jpg");
}
