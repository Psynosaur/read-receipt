#!/usr/bin/env deno run --allow-read --allow-write

/**
 * Test suite for rotation detection and correction functionality
 * in the white receipt detector.
 */

import { assertEquals, assertGreater, assertLess } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Import the main function (we'll need to modify the detector to export the function)
// For now, we'll test by running the detector and checking outputs

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  rotationApplied?: boolean;
  detectedAngle?: number;
  confidence?: number;
}

/**
 * Test rotation detection with a known rotated image
 */
async function testRotationDetection(imagePath: string, expectedRotation?: number): Promise<TestResult> {
  const testName = `Rotation Detection Test - ${imagePath}`;
  
  try {
    // Run the detector and capture output
    const outputPath = `test_output_${Date.now()}.jpg`;
    
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
    console.log(`Output for ${imagePath}:`);
    console.log(output);
    
    // Parse the output to extract rotation information
    const rotationMatch = output.match(/🔄 Applying rotation correction: ([-\d.]+)° \(confidence: ([\d.]+)\)/);
    const skippedMatch = output.match(/⏭️  Skipping rotation: angle=([-\d.]+)°, confidence=([\d.]+)/);
    
    let rotationApplied = false;
    let detectedAngle = 0;
    let confidence = 0;
    
    if (rotationMatch) {
      rotationApplied = true;
      detectedAngle = parseFloat(rotationMatch[1]);
      confidence = parseFloat(rotationMatch[2]);
    } else if (skippedMatch) {
      rotationApplied = false;
      detectedAngle = parseFloat(skippedMatch[1]);
      confidence = parseFloat(skippedMatch[2]);
    }
    
    // Clean up output file
    try {
      await Deno.remove(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    
    // Validate results
    let passed = true;
    let details = `Detected angle: ${detectedAngle}°, Confidence: ${confidence}, Applied: ${rotationApplied}`;
    
    if (expectedRotation !== undefined) {
      const angleDiff = Math.abs(detectedAngle - expectedRotation);
      if (angleDiff > 10) { // Allow 10 degree tolerance
        passed = false;
        details += ` - Expected ~${expectedRotation}°, got ${detectedAngle}° (diff: ${angleDiff}°)`;
      }
    }
    
    // Check that significant rotations are detected
    if (Math.abs(detectedAngle) > 10 && !rotationApplied && confidence < 0.02) {
      passed = false;
      details += ` - Large rotation detected but not applied due to low confidence`;
    }
    
    return {
      testName,
      passed,
      details,
      rotationApplied,
      detectedAngle,
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
 * Test that the detector handles images without rotation correctly
 */
async function testNoRotationNeeded(imagePath: string): Promise<TestResult> {
  const testName = `No Rotation Test - ${imagePath}`;
  
  try {
    const outputPath = `test_output_no_rotation_${Date.now()}.jpg`;
    
    const process = new Deno.Command("deno", {
      args: ["run", "--allow-read", "--allow-write", "--allow-net", "white_receipt_detector.ts", imagePath, outputPath],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { code, stdout } = await process.output();
    
    if (code !== 0) {
      return {
        testName,
        passed: false,
        details: `Process failed with code ${code}`
      };
    }
    
    const output = new TextDecoder().decode(stdout);
    
    // Check that either no significant rotation was detected or it was skipped
    const rotationMatch = output.match(/🔄 Applying rotation correction: ([-\d.]+)°/);
    const skippedMatch = output.match(/⏭️  Skipping rotation: angle=([-\d.]+)°/);
    
    let passed = true;
    let details = "";
    
    if (rotationMatch) {
      const angle = parseFloat(rotationMatch[1]);
      if (Math.abs(angle) > 5) {
        passed = false;
        details = `Unexpected large rotation applied: ${angle}°`;
      } else {
        details = `Small rotation correction applied: ${angle}° (acceptable)`;
      }
    } else if (skippedMatch) {
      const angle = parseFloat(skippedMatch[1]);
      details = `Rotation skipped: ${angle}° (correct behavior)`;
    } else {
      details = "No rotation information found in output";
    }
    
    // Clean up
    try {
      await Deno.remove(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    
    return {
      testName,
      passed,
      details
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
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Starting Rotation Detection Tests\n");
  
  const results: TestResult[] = [];
  
  // Test 1: Known rotated image (oh.jpg)
  console.log("📋 Test 1: Testing rotation detection with oh.jpg");
  results.push(await testRotationDetection("oh.jpg", 45)); // Expecting ~45 degree rotation
  
  // Test 2: Test with the same image again to ensure consistency
  console.log("\n📋 Test 2: Testing consistency with oh.jpg (second run)");
  results.push(await testRotationDetection("oh.jpg", 45));
  
  // Test 3: If there are other test images, test them
  // (We'll add more tests if other images are available)
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  
  let passedCount = 0;
  let totalCount = results.length;
  
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.testName}`);
    console.log(`   ${result.details}`);
    
    if (result.rotationApplied !== undefined) {
      console.log(`   Rotation Applied: ${result.rotationApplied}`);
      console.log(`   Detected Angle: ${result.detectedAngle}°`);
      console.log(`   Confidence: ${result.confidence}`);
    }
    
    console.log("");
    
    if (result.passed) passedCount++;
  }
  
  console.log("=".repeat(60));
  console.log(`📈 OVERALL RESULT: ${passedCount}/${totalCount} tests passed`);
  
  if (passedCount === totalCount) {
    console.log("🎉 All tests passed! Rotation detection is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please review the rotation detection algorithm.");
  }
  
  return passedCount === totalCount;
}

// Run tests if this file is executed directly
if (import.meta.main) {
  const success = await runTests();
  Deno.exit(success ? 0 : 1);
}
