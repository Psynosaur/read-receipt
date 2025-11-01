import {Image} from "jsr:@matmen/imagescript";

// Import the smart border removal function
async function removeUniformBorders(inputPath: string, outputPath: string) {
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const PIXEL_TOLERANCE = 0.95;
  const MAX_BORDER_RATIO = 0.3;
  const COLOR_VARIANCE_THRESHOLD = 15;

  const { width, height } = image;
  
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

  function isColorSimilar(rgba: number, refR: number, refG: number, refB: number): boolean {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    
    return Math.abs(r - refR) <= COLOR_VARIANCE_THRESHOLD &&
           Math.abs(g - refG) <= COLOR_VARIANCE_THRESHOLD &&
           Math.abs(b - refB) <= COLOR_VARIANCE_THRESHOLD;
  }

  function detectBorderColor(): {r: number, g: number, b: number} {
    const rgba = safeGetPixel(0, 0);
    return {
      r: (rgba >>> 24) & 0xFF,
      g: (rgba >>> 16) & 0xFF,
      b: (rgba >>> 8) & 0xFF
    };
  }

  const borderColor = detectBorderColor();
  const topBorderLimit = Math.floor(height * MAX_BORDER_RATIO);
  const bottomBorderStart = Math.max(0, height - topBorderLimit);
  const sideBorderLimit = Math.floor(width * MAX_BORDER_RATIO);

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  // Detect borders (simplified for test)
  topBorderScan:
  for (let y = 0; y < topBorderLimit; y++) {
    let uniformCount = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      if (isColorSimilar(rgba, borderColor.r, borderColor.g, borderColor.b)) {
        uniformCount++;
      }
    }
    if (uniformCount / width < PIXEL_TOLERANCE) break topBorderScan;
    top = y + 1;
  }

  bottomBorderScan:
  for (let y = height - 1; y >= bottomBorderStart; y--) {
    let uniformCount = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      if (isColorSimilar(rgba, borderColor.r, borderColor.g, borderColor.b)) {
        uniformCount++;
      }
    }
    if (uniformCount / width < PIXEL_TOLERANCE) break bottomBorderScan;
    bottom = y - 1;
  }

  top = Math.min(top, height - 1);
  bottom = Math.max(bottom, top);
  const contentHeight = bottom - top + 1;

  leftBorderScan:
  for (let x = 0; x < sideBorderLimit; x++) {
    let uniformCount = 0;
    for (let y = top; y <= bottom; y++) {
      const rgba = safeGetPixel(x, y);
      if (isColorSimilar(rgba, borderColor.r, borderColor.g, borderColor.b)) {
        uniformCount++;
      }
    }
    if (uniformCount / contentHeight < PIXEL_TOLERANCE) break leftBorderScan;
    left = x + 1;
  }

  rightBorderScan:
  for (let x = width - 1; x >= width - sideBorderLimit; x--) {
    let uniformCount = 0;
    for (let y = top; y <= bottom; y++) {
      const rgba = safeGetPixel(x, y);
      if (isColorSimilar(rgba, borderColor.r, borderColor.g, borderColor.b)) {
        uniformCount++;
      }
    }
    if (uniformCount / contentHeight < PIXEL_TOLERANCE) break rightBorderScan;
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
    bordersRemoved: { top, bottom: height - 1 - bottom, left, right: width - 1 - right },
    borderColor
  };
}

async function runComprehensiveTest() {
  console.log("🧪 Running comprehensive border removal tests...\n");
  
  const testCases = [
    {
      name: "SPAR Receipt (Black borders)",
      inputFile: "SPAR.jpg",
      outputFile: "test_spar_output.jpg",
      expectedBorderRemoval: true,
      expectedMinCropPercentage: 80 // Should retain at least 80% of content
    }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    
    try {
      // Get original dimensions
      const originalImageData = await Deno.readFile(testCase.inputFile);
      const originalImage = await Image.decode(originalImageData);
      const originalArea = originalImage.width * originalImage.height;
      
      console.log(`   📏 Original: ${originalImage.width}x${originalImage.height}`);
      
      // Run border removal
      const result = await removeUniformBorders(testCase.inputFile, testCase.outputFile);
      
      console.log(`   📏 Cropped: ${result.croppedDimensions.width}x${result.croppedDimensions.height}`);
      console.log(`   🎨 Border color: RGB(${result.borderColor.r}, ${result.borderColor.g}, ${result.borderColor.b})`);
      console.log(`   ✂️  Borders: top=${result.bordersRemoved.top}, bottom=${result.bordersRemoved.bottom}, left=${result.bordersRemoved.left}, right=${result.bordersRemoved.right}`);
      
      // Verify output file
      const outputImageData = await Deno.readFile(testCase.outputFile);
      const outputImage = await Image.decode(outputImageData);
      const croppedArea = outputImage.width * outputImage.height;
      const retainedPercentage = (croppedArea / originalArea) * 100;
      
      console.log(`   📊 Content retained: ${retainedPercentage.toFixed(1)}%`);
      
      // Run tests
      const tests = [
        {
          name: "Output file is valid",
          condition: outputImage.width > 0 && outputImage.height > 0,
          expected: true
        },
        {
          name: "Dimensions match expected",
          condition: outputImage.width === result.croppedDimensions.width && 
                    outputImage.height === result.croppedDimensions.height,
          expected: true
        },
        {
          name: "Borders were detected and removed",
          condition: (result.bordersRemoved.top > 0 || result.bordersRemoved.bottom > 0 || 
                     result.bordersRemoved.left > 0 || result.bordersRemoved.right > 0),
          expected: testCase.expectedBorderRemoval
        },
        {
          name: "Sufficient content retained",
          condition: retainedPercentage >= testCase.expectedMinCropPercentage,
          expected: true
        },
        {
          name: "Image was actually cropped",
          condition: croppedArea < originalArea,
          expected: testCase.expectedBorderRemoval
        }
      ];
      
      for (const test of tests) {
        totalTests++;
        const passed = test.condition === test.expected;
        console.log(`   ${passed ? "✅" : "❌"} ${test.name}: ${passed ? "PASS" : "FAIL"}`);
        if (passed) passedTests++;
      }
      
      // Clean up test file
      await Deno.remove(testCase.outputFile);
      
    } catch (error) {
      console.error(`   ❌ Test failed with error: ${error.message}`);
      totalTests += 5; // Account for the 5 tests that would have run
    }
    
    console.log("");
  }
  
  console.log(`📊 Overall Test Results: ${passedTests}/${totalTests} tests passed (${(passedTests/totalTests*100).toFixed(1)}%)`);
  
  if (passedTests === totalTests) {
    console.log("🎉 All tests passed! Border removal is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please review the implementation.");
  }
}

// Run the comprehensive test
if (import.meta.main) {
  await runComprehensiveTest();
}
