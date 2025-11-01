import {Image} from "jsr:@matmen/imagescript";
import { normalizeImage, ImageNormalizationOptions } from "./image_normalizer.ts";

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
}

/**
 * Test image normalization with different methods
 */
async function testImageNormalization(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test 1: Basic letterbox normalization
  results.push(await testLetterboxNormalization());
  
  // Test 2: Crop normalization
  results.push(await testCropNormalization());
  
  // Test 3: Stretch normalization
  results.push(await testStretchNormalization());
  
  // Test 4: Chunking for long receipts
  results.push(await testChunkingNormalization());
  
  // Test 5: Chunking with custom overlap
  results.push(await testChunkingWithOverlap());
  
  return results;
}

/**
 * Test letterbox normalization (preserve aspect ratio, add padding)
 */
async function testLetterboxNormalization(): Promise<TestResult> {
  const testName = "Letterbox Normalization Test";
  
  try {
    const result = await normalizeImage("ss.jpg", "test_letterbox_output.jpg", {
      method: 'letterbox',
      jpegQuality: 85
    });
    
    // Verify output dimensions
    if (result.normalizedDimensions.width !== 896 || result.normalizedDimensions.height !== 896) {
      return {
        testName,
        passed: false,
        details: `Expected 896x896, got ${result.normalizedDimensions.width}x${result.normalizedDimensions.height}`
      };
    }
    
    // Verify aspect ratio was preserved
    if (!result.aspectRatioPreserved) {
      return {
        testName,
        passed: false,
        details: "Aspect ratio should be preserved in letterbox mode"
      };
    }
    
    // Verify output file exists
    try {
      const stat = await Deno.stat("test_letterbox_output.jpg");
      if (stat.size === 0) {
        return {
          testName,
          passed: false,
          details: "Output file is empty"
        };
      }
    } catch {
      return {
        testName,
        passed: false,
        details: "Output file was not created"
      };
    }
    
    return {
      testName,
      passed: true,
      details: `Successfully normalized to ${result.normalizedDimensions.width}x${result.normalizedDimensions.height}, scale factor: ${result.scaleFactor.toFixed(3)}`
    };
    
  } catch (error) {
    return {
      testName,
      passed: false,
      details: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test crop normalization (preserve aspect ratio, crop excess)
 */
async function testCropNormalization(): Promise<TestResult> {
  const testName = "Crop Normalization Test";
  
  try {
    const result = await normalizeImage("ss.jpg", "test_crop_output.jpg", {
      method: 'crop',
      jpegQuality: 85
    });
    
    // Verify output dimensions
    if (result.normalizedDimensions.width !== 896 || result.normalizedDimensions.height !== 896) {
      return {
        testName,
        passed: false,
        details: `Expected 896x896, got ${result.normalizedDimensions.width}x${result.normalizedDimensions.height}`
      };
    }
    
    // Verify aspect ratio was preserved
    if (!result.aspectRatioPreserved) {
      return {
        testName,
        passed: false,
        details: "Aspect ratio should be preserved in crop mode"
      };
    }
    
    return {
      testName,
      passed: true,
      details: `Successfully normalized to ${result.normalizedDimensions.width}x${result.normalizedDimensions.height}, scale factor: ${result.scaleFactor.toFixed(3)}`
    };
    
  } catch (error) {
    return {
      testName,
      passed: false,
      details: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test stretch normalization (may distort aspect ratio)
 */
async function testStretchNormalization(): Promise<TestResult> {
  const testName = "Stretch Normalization Test";
  
  try {
    const result = await normalizeImage("ss.jpg", "test_stretch_output.jpg", {
      method: 'stretch',
      jpegQuality: 85
    });
    
    // Verify output dimensions
    if (result.normalizedDimensions.width !== 896 || result.normalizedDimensions.height !== 896) {
      return {
        testName,
        passed: false,
        details: `Expected 896x896, got ${result.normalizedDimensions.width}x${result.normalizedDimensions.height}`
      };
    }
    
    return {
      testName,
      passed: true,
      details: `Successfully normalized to ${result.normalizedDimensions.width}x${result.normalizedDimensions.height}, aspect ratio preserved: ${result.aspectRatioPreserved}`
    };
    
  } catch (error) {
    return {
      testName,
      passed: false,
      details: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test chunking normalization for long receipts
 */
async function testChunkingNormalization(): Promise<TestResult> {
  const testName = "Chunking Normalization Test";
  
  try {
    // Create a synthetic long receipt image for testing
    const longImage = new Image(600, 2400); // Very tall image
    longImage.fill(0xFFFFFFFF); // White background
    
    // Add some content patterns to simulate receipt text
    for (let y = 0; y < 2400; y += 100) {
      for (let x = 50; x < 550; x += 50) {
        longImage.drawBox(x, y, 40, 20, 0x000000FF); // Black rectangles
      }
    }
    
    // Save the test image
    const testImageData = await longImage.encode();
    await Deno.writeFile("test_long_receipt.jpg", testImageData);
    
    // Test chunking
    const result = await normalizeImage("test_long_receipt.jpg", "test_chunk_output.jpg", {
      method: 'chunk',
      jpegQuality: 85,
      chunkOverlap: 50
    });
    
    // Verify chunks were created
    if (!result.chunksCreated || result.chunksCreated < 2) {
      return {
        testName,
        passed: false,
        details: `Expected multiple chunks, got ${result.chunksCreated || 0}`
      };
    }
    
    // Verify chunk files exist
    if (!result.chunkPaths || result.chunkPaths.length !== result.chunksCreated) {
      return {
        testName,
        passed: false,
        details: "Chunk paths don't match chunk count"
      };
    }
    
    // Verify each chunk file exists and has correct dimensions
    for (let i = 0; i < result.chunkPaths.length; i++) {
      const chunkPath = result.chunkPaths[i];
      try {
        const chunkData = await Deno.readFile(chunkPath);
        const chunkImage = await Image.decode(chunkData);
        
        if (chunkImage.width !== 896 || chunkImage.height !== 896) {
          return {
            testName,
            passed: false,
            details: `Chunk ${i + 1} has wrong dimensions: ${chunkImage.width}x${chunkImage.height}`
          };
        }
      } catch {
        return {
          testName,
          passed: false,
          details: `Chunk ${i + 1} file could not be read: ${chunkPath}`
        };
      }
    }
    
    return {
      testName,
      passed: true,
      details: `Successfully created ${result.chunksCreated} chunks, each 896x896`
    };
    
  } catch (error) {
    return {
      testName,
      passed: false,
      details: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test chunking with custom overlap
 */
async function testChunkingWithOverlap(): Promise<TestResult> {
  const testName = "Chunking with Custom Overlap Test";
  
  try {
    const result = await normalizeImage("test_long_receipt.jpg", "test_chunk_overlap_output.jpg", {
      method: 'chunk',
      jpegQuality: 85,
      chunkOverlap: 100 // Larger overlap
    });
    
    // Verify chunks were created
    if (!result.chunksCreated || result.chunksCreated < 2) {
      return {
        testName,
        passed: false,
        details: `Expected multiple chunks, got ${result.chunksCreated || 0}`
      };
    }
    
    // With larger overlap, we should get more chunks
    const expectedChunks = Math.ceil(2400 / (896 - 100)); // Rough calculation
    if (result.chunksCreated < expectedChunks - 1) { // Allow some tolerance
      return {
        testName,
        passed: false,
        details: `Expected around ${expectedChunks} chunks with 100px overlap, got ${result.chunksCreated}`
      };
    }
    
    return {
      testName,
      passed: true,
      details: `Successfully created ${result.chunksCreated} chunks with 100px overlap`
    };
    
  } catch (error) {
    return {
      testName,
      passed: false,
      details: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Run all tests and display results
 */
async function runAllTests(): Promise<void> {
  console.log("🧪 Running Image Normalization Tests...\n");
  
  const results = await testImageNormalization();
  
  let passedCount = 0;
  let totalCount = results.length;
  
  results.forEach((result, index) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${index + 1}. ${status} - ${result.testName}`);
    console.log(`   ${result.details}\n`);
    
    if (result.passed) passedCount++;
  });
  
  console.log(`📊 Test Results: ${passedCount}/${totalCount} tests passed (${((passedCount/totalCount)*100).toFixed(1)}%)`);
  
  if (passedCount === totalCount) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️  Some tests failed. Please review the results above.");
  }
  
  // Clean up test files
  try {
    await Deno.remove("test_letterbox_output.jpg");
    await Deno.remove("test_crop_output.jpg");
    await Deno.remove("test_stretch_output.jpg");
    await Deno.remove("test_long_receipt.jpg");
    
    // Clean up chunk files
    for (let i = 1; i <= 10; i++) { // Try to clean up potential chunk files
      try {
        await Deno.remove(`test_chunk_output_${i}.jpg`);
        await Deno.remove(`test_chunk_overlap_output_${i}.jpg`);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runAllTests();
}
