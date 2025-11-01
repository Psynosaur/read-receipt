import {Image} from "jsr:@matmen/imagescript";

// Import the function we want to test
async function removeWhiteBorders(inputPath: string, outputPath: string) {
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const WHITE_THRESHOLD = 230;
  const PIXEL_TOLERANCE = 0.95;
  const MAX_BORDER_RATIO = 0.3;

  const { width, height } = image;
  
  if (width === 0 || height === 0) {
    throw new Error("Image has zero dimensions");
  }

  // Helper function to safely get pixel with boundary checks
  function safeGetPixel(x: number, y: number): number {
    // Convert to 1-based indexing and check boundaries
    const pixelX = x + 1;
    const pixelY = y + 1;
    
    if (pixelX < 1 || pixelX > width || pixelY < 1 || pixelY > height) {
      // Return white pixel (0xFFFFFFFF) for out-of-bounds access
      return 0xFFFFFFFF;
    }
    
    return image.getPixelAt(pixelX, pixelY);
  }

  const topBorderLimit = Math.floor(height * MAX_BORDER_RATIO);
  const bottomBorderStart = Math.max(0, height - topBorderLimit);
  const sideBorderLimit = Math.floor(width * MAX_BORDER_RATIO);

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  // Detect top border
  topBorderScan:
  for (let y = 0; y < topBorderLimit; y++) {
    let whiteCount = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / width < PIXEL_TOLERANCE) break topBorderScan;
    top = y + 1;
  }

  // Detect bottom border
  bottomBorderScan:
  for (let y = height - 1; y >= bottomBorderStart; y--) {
    let whiteCount = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;

      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / width < PIXEL_TOLERANCE) break bottomBorderScan;
    bottom = y - 1;
  }

  top = Math.min(top, height - 1);
  bottom = Math.max(bottom, top);
  const contentHeight = bottom - top + 1;

  // Detect left border
  leftBorderScan:
  for (let x = 0; x < sideBorderLimit; x++) {
    let whiteCount = 0;
    for (let y = top; y <= bottom; y++) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / contentHeight < PIXEL_TOLERANCE) break leftBorderScan;
    left = x + 1;
  }

  // Detect right border
  rightBorderScan:
  for (let x = width - 1; x >= width - sideBorderLimit; x--) {
    let whiteCount = 0;
    for (let y = top; y <= bottom; y++) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;
      
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / contentHeight < PIXEL_TOLERANCE) break rightBorderScan;
    right = x - 1;
  }

  left = Math.min(left, width - 1);
  right = Math.max(right, left);
  const contentWidth = right - left + 1;

  if (contentWidth > 0 && contentHeight > 0) {
    image.crop(left, top, contentWidth, contentHeight);
  }

  const output = await image.encode();
  await Deno.writeFile(outputPath, output);
  
  return {
    originalDimensions: { width, height },
    croppedDimensions: { width: contentWidth, height: contentHeight },
    bordersRemoved: { top, bottom: height - 1 - bottom, left, right: width - 1 - right }
  };
}

// Test functions
async function testBorderRemoval() {
  console.log("🧪 Testing border removal functionality...");
  
  try {
    // Test with the SPAR receipt image
    const testInputPath = "SPAR.jpg";
    const testOutputPath = "test_output.jpg";
    
    // Get original image dimensions
    const originalImageData = await Deno.readFile(testInputPath);
    const originalImage = await Image.decode(originalImageData);
    const originalWidth = originalImage.width;
    const originalHeight = originalImage.height;
    
    console.log(`📏 Original image dimensions: ${originalWidth}x${originalHeight}`);
    
    // Run border removal
    const result = await removeWhiteBorders(testInputPath, testOutputPath);
    
    console.log(`📏 Cropped image dimensions: ${result.croppedDimensions.width}x${result.croppedDimensions.height}`);
    console.log(`✂️  Borders removed: top=${result.bordersRemoved.top}, bottom=${result.bordersRemoved.bottom}, left=${result.bordersRemoved.left}, right=${result.bordersRemoved.right}`);
    
    // Verify the output file exists and has valid dimensions
    const outputImageData = await Deno.readFile(testOutputPath);
    const outputImage = await Image.decode(outputImageData);
    
    // Test assertions
    const tests = [
      {
        name: "Output file exists and is readable",
        condition: outputImage.width > 0 && outputImage.height > 0,
        expected: true
      },
      {
        name: "Output dimensions match expected cropped dimensions",
        condition: outputImage.width === result.croppedDimensions.width && outputImage.height === result.croppedDimensions.height,
        expected: true
      },
      {
        name: "Image was actually cropped (dimensions changed)",
        condition: outputImage.width < originalWidth || outputImage.height < originalHeight,
        expected: true
      },
      {
        name: "Cropped image is not empty",
        condition: outputImage.width > 10 && outputImage.height > 10,
        expected: true
      }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
      const passed = test.condition === test.expected;
      console.log(`${passed ? "✅" : "❌"} ${test.name}: ${passed ? "PASS" : "FAIL"}`);
      if (passed) passedTests++;
    }
    
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log("🎉 All tests passed! Border removal is working correctly.");
    } else {
      console.log("⚠️  Some tests failed. Please check the implementation.");
    }
    
    // Clean up test file
    await Deno.remove(testOutputPath);
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

// Run the test
if (import.meta.main) {
  await testBorderRemoval();
}
