/**
 * Test suite for rotation detection fix
 * Tests that ss.jpg no longer gets incorrectly rotated 90 degrees
 * and that other images still work correctly
 */

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  rotationApplied?: number;
  confidence?: number;
}

/**
 * Test rotation detection with a specific image and expected behavior
 */
async function testRotationDetection(
  imagePath: string, 
  expectedMaxRotation: number,
  testDescription: string
): Promise<TestResult> {
  const testName = `${testDescription} - ${imagePath}`;
  
  try {
    // Run the detector and capture output
    const outputPath = `test_fix_output_${Date.now()}.jpg`;
    
    const process = new Deno.Command("deno", {
      args: ["run", "--allow-read", "--allow-write", "--allow-net", "white_receipt_detector.ts", imagePath, outputPath],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { code, stdout, stderr } = await process.output();
    
    if (code !== 0) {
      return {
        testName,
        passed: false,
        details: `Process failed with code ${code}: ${new TextDecoder().decode(stderr)}`
      };
    }
    
    const output = new TextDecoder().decode(stdout);
    console.log(`\n📋 ${testName}`);
    console.log("Output:");
    console.log(output);
    
    // Parse the output to extract rotation information
    const rotationMatch = output.match(/🔄 Applying rotation correction: ([-\d.]+)° \(confidence: ([\d.]+)\)/);
    const skippedMatch = output.match(/⏭️  Skipping rotation: angle=([-\d.]+)°, confidence=([\d.]+)/);
    const rejectedMatch = output.match(/⚠️  Large rotation detected \(([-\d.]+)°\), likely misdetection/);
    
    let rotationApplied = 0;
    let confidence = 0;
    let wasSkipped = false;
    let wasRejected = false;
    
    if (rotationMatch) {
      rotationApplied = parseFloat(rotationMatch[1]);
      confidence = parseFloat(rotationMatch[2]);
    } else if (skippedMatch) {
      rotationApplied = parseFloat(skippedMatch[1]);
      confidence = parseFloat(skippedMatch[2]);
      wasSkipped = true;
    } else if (rejectedMatch) {
      rotationApplied = parseFloat(rejectedMatch[1]);
      wasRejected = true;
    }
    
    // Check if rotation is within expected bounds
    const passed = Math.abs(rotationApplied) <= expectedMaxRotation;
    
    let details = "";
    if (wasRejected) {
      details = `✅ Large rotation correctly rejected: ${rotationApplied}°`;
    } else if (wasSkipped) {
      details = `✅ Rotation skipped: ${rotationApplied}° (confidence: ${confidence})`;
    } else if (passed) {
      details = `✅ Acceptable rotation applied: ${rotationApplied}° (confidence: ${confidence})`;
    } else {
      details = `❌ Excessive rotation applied: ${rotationApplied}° (expected max: ${expectedMaxRotation}°)`;
    }
    
    // Clean up test output file
    try {
      await Deno.remove(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    
    return {
      testName,
      passed,
      details,
      rotationApplied,
      confidence
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
 * Test that ss.jpg no longer gets rotated 90 degrees
 */
async function testSsJpgFix(): Promise<TestResult> {
  return await testRotationDetection(
    "ss.jpg", 
    10, // Should not rotate more than 10 degrees
    "SS.jpg rotation fix test"
  );
}

/**
 * Test that oh.jpg still works correctly (should allow larger rotations)
 */
async function testOhJpgStillWorks(): Promise<TestResult> {
  return await testRotationDetection(
    "oh.jpg", 
    50, // This image legitimately needs ~44 degree rotation
    "OH.jpg regression test"
  );
}

/**
 * Test with SPAR.jpg to ensure normal receipts work
 */
async function testSparJpg(): Promise<TestResult> {
  return await testRotationDetection(
    "SPAR.jpg", 
    15, // Should be minimal rotation for a normal receipt
    "SPAR.jpg normal receipt test"
  );
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Starting Rotation Fix Tests\n");
  console.log("Testing the fix for ss.jpg 90-degree rotation issue...\n");
  
  const results: TestResult[] = [];
  
  // Test 1: Verify ss.jpg fix
  console.log("=" .repeat(60));
  results.push(await testSsJpgFix());
  
  // Test 2: Verify oh.jpg still works
  console.log("=" .repeat(60));
  results.push(await testOhJpgStillWorks());
  
  // Test 3: Test normal receipt
  console.log("=" .repeat(60));
  results.push(await testSparJpg());
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  
  let passedCount = 0;
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.testName}`);
    console.log(`     ${result.details}`);
    if (result.rotationApplied !== undefined) {
      console.log(`     Rotation: ${result.rotationApplied}°${result.confidence ? `, Confidence: ${result.confidence}` : ''}`);
    }
    console.log();
    
    if (result.passed) passedCount++;
  }
  
  console.log(`📈 Results: ${passedCount}/${results.length} tests passed`);
  
  if (passedCount === results.length) {
    console.log("🎉 All tests passed! The rotation fix is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please review the results above.");
  }
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runTests().catch(console.error);
}

export { runTests, testSsJpgFix, testOhJpgStillWorks, testSparJpg };
