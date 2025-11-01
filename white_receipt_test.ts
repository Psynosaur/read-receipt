import {Image} from "jsr:@matmen/imagescript";

interface Point {
  x: number;
  y: number;
}

async function detectWhiteReceiptArea(inputPath: string, outputPath: string) {
  console.log(`🎯 Detecting white receipt area in: ${inputPath}`);
  
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const { width, height } = image;
  console.log(`📏 Original dimensions: ${width}x${height}`);
  
  function safeGetPixel(x: number, y: number): number {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return 0x00000000;
    }
    return image.getPixelAt(x + 1, y + 1);
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
  
  // Find all connected components
  for (let y = 0; y < height; y += 5) {
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
  
  // Find bounding box of the largest white area
  let minX = width, maxX = 0, minY = height, maxY = 0;
  
  for (const point of largestAreaPoints) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  
  // Add padding to ensure we capture the full receipt
  const PADDING = 20;
  const cropLeft = Math.max(0, minX - PADDING);
  const cropTop = Math.max(0, minY - PADDING);
  const cropRight = Math.min(width - 1, maxX + PADDING);
  const cropBottom = Math.min(height - 1, maxY + PADDING);
  
  const cropWidth = cropRight - cropLeft + 1;
  const cropHeight = cropBottom - cropTop + 1;
  
  console.log(`✂️ Cropping to white receipt area:`);
  console.log(`   White area bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
  console.log(`   With padding: (${cropLeft}, ${cropTop}) to (${cropRight}, ${cropBottom})`);
  console.log(`   Final crop: ${cropWidth}x${cropHeight}`);
  
  // Perform the crop
  image.crop(cropLeft, cropTop, cropWidth, cropHeight);
  
  // Save the result
  const output = await image.encode();
  await Deno.writeFile(outputPath, output);
  
  const originalArea = width * height;
  const croppedArea = cropWidth * cropHeight;
  const retainedPercentage = (croppedArea / originalArea) * 100;
  
  console.log(`💾 Saved white area cropped image to: ${outputPath}`);
  
  return {
    originalDimensions: { width, height },
    croppedDimensions: { width: cropWidth, height: cropHeight },
    whiteBounds: { minX, minY, maxX, maxY },
    bordersRemoved: { 
      top: cropTop, 
      bottom: height - 1 - cropBottom, 
      left: cropLeft, 
      right: width - 1 - cropRight 
    },
    retainedPercentage,
    whitePixelCount,
    largestWhiteArea: largestArea
  };
}

async function testWhiteReceiptDetection(inputImagePath: string) {
  console.log("🧪 Testing white receipt area detection...\n");
  
  // Extract filename for naming
  const filename = inputImagePath.split('/').pop()?.split('\\').pop() || 'unknown';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  const testCase = {
    name: `${nameWithoutExt} Receipt`,
    inputFile: inputImagePath,
    outputFile: `test_white_${nameWithoutExt}.jpg`,
    expectedMinBorderRemoval: 10, // Should remove at least 10% of the image as borders
    expectedMaxAreaRetention: 90,  // Should not retain more than 90% (some border removal expected)
    expectedMinWhiteArea: 30      // Should find at least 30% white pixels
  };
  
  console.log(`📋 Testing: ${testCase.name}`);
  
  try {
    // Get original image info
    const originalImageData = await Deno.readFile(testCase.inputFile);
    const originalImage = await Image.decode(originalImageData);
    
    console.log(`   📏 Original: ${originalImage.width}x${originalImage.height}`);
    
    // Run white receipt detection
    const result = await detectWhiteReceiptArea(testCase.inputFile, testCase.outputFile);
    
    console.log(`   📏 Cropped: ${result.croppedDimensions.width}x${result.croppedDimensions.height}`);
    console.log(`   ✂️  Borders removed: top=${result.bordersRemoved.top}, bottom=${result.bordersRemoved.bottom}, left=${result.bordersRemoved.left}, right=${result.bordersRemoved.right}`);
    console.log(`   📊 Area retained: ${result.retainedPercentage.toFixed(1)}%`);
    console.log(`   🤍 White pixels: ${result.whitePixelCount} (${((result.whitePixelCount / (result.originalDimensions.width * result.originalDimensions.height)) * 100).toFixed(1)}%)`);
    
    // Verify output file
    const outputImageData = await Deno.readFile(testCase.outputFile);
    const outputImage = await Image.decode(outputImageData);
    
    // Test suite
    const tests = [
      {
        name: "Output file is valid and readable",
        condition: outputImage.width > 0 && outputImage.height > 0,
        expected: true
      },
      {
        name: "Output dimensions match expected",
        condition: outputImage.width === result.croppedDimensions.width && 
                  outputImage.height === result.croppedDimensions.height,
        expected: true
      },
      {
        name: "Some border removal occurred",
        condition: result.retainedPercentage < testCase.expectedMaxAreaRetention,
        expected: true
      },
      {
        name: "Sufficient white area detected",
        condition: ((result.whitePixelCount / (result.originalDimensions.width * result.originalDimensions.height)) * 100) >= testCase.expectedMinWhiteArea,
        expected: true
      },
      {
        name: "Reasonable output dimensions",
        condition: result.croppedDimensions.width > 200 && result.croppedDimensions.height > 300,
        expected: true
      },
      {
        name: "Maintains receipt aspect ratio",
        condition: (result.croppedDimensions.height / result.croppedDimensions.width) > 1.0,
        expected: true
      }
    ];
    
    let passedTests = 0;
    for (const test of tests) {
      const passed = test.condition === test.expected;
      console.log(`   ${passed ? "✅" : "❌"} ${test.name}: ${passed ? "PASS" : "FAIL"}`);
      if (passed) passedTests++;
      
      if (!passed) {
        console.log(`      Expected: ${test.expected}, Got: ${test.condition}`);
      }
    }
    
    console.log(`\n📊 Test Results: ${passedTests}/${tests.length} tests passed (${(passedTests/tests.length*100).toFixed(1)}%)`);
    
    if (passedTests === tests.length) {
      console.log("🎉 All tests passed! White receipt detection is working correctly.");
    } else {
      console.log("⚠️  Some tests failed. Please review the implementation.");
    }
    
    // Clean up test file
    await Deno.remove(testCase.outputFile);
    
  } catch (error) {
    console.error(`   ❌ Test failed with error: ${error.message}`);
  }
}

// Usage
if (import.meta.main) {
  const imagePath = Deno.args[0];
  if (!imagePath) {
    console.error("❌ Error: Please provide an image file path");
    console.error("Usage: deno run --allow-read --allow-write white_receipt_test.ts <image_path>");
    Deno.exit(1);
  }
  await testWhiteReceiptDetection(imagePath);
}
