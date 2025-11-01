import { Image } from "jsr:@matmen/imagescript";

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  outputPath?: string;
  dimensions?: { width: number; height: number };
  fileSize?: number;
}

/**
 * Test suite for the white receipt detector
 */
async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log("🧪 Starting White Receipt Detector Test Suite");
  console.log("=" .repeat(50));
  
  // Since the main function isn't exported, we'll run it as a subprocess
  async function runDetector(
    inputPath: string,
    outputPath: string,
    quality: number = 85,
    sharpening: boolean = false,
    sharpeningStrength: number = 1.0,
    contrast: boolean = false,
    contrastFactor: number = 1.5,
    threshold: boolean = false,
    thresholdValue: number = 128
  ) {
    const sharpeningArg = sharpening ? "true" : "false";
    const contrastArg = contrast ? "true" : "false";
    const thresholdArg = threshold ? "true" : "false";
    const command = `deno run --allow-read --allow-write --allow-net imageParser/white_receipt_detector.ts ${inputPath} ${outputPath} ${quality} ${sharpeningArg} ${sharpeningStrength} ${contrastArg} ${contrastFactor} ${thresholdArg} ${thresholdValue}`;

    const process = new Deno.Command("powershell", {
      args: ["-c", command],
      stdout: "piped",
      stderr: "piped"
    });

    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Detector failed: ${errorText}`);
    }

    // Parse output for dimensions and stats
    const outputText = new TextDecoder().decode(stdout);
    const dimensionMatch = outputText.match(/Final crop: (\d+)x(\d+)/);
    const retainedMatch = outputText.match(/Area retained: ([\d.]+)%/);
    const thresholdApplied = outputText.includes("Applying threshold transformation");
    const contrastApplied = outputText.includes("Applying contrast enhancement");

    return {
      croppedDimensions: dimensionMatch ?
        { width: parseInt(dimensionMatch[1]), height: parseInt(dimensionMatch[2]) } :
        { width: 0, height: 0 },
      statistics: {
        retainedPercentage: retainedMatch ? parseFloat(retainedMatch[1]) : 0
      },
      thresholdApplied,
      contrastApplied
    };
  }
  
  // Test 1: Basic functionality with temp_receipt.jpg
  try {
    console.log("\n📋 Test 1: Basic receipt detection");
    const result = await runDetector(
      "imageParser/temp_receipt.jpg",
      "imageParser/test_output_basic.jpg",
      85
    );
    
    const passed = result.croppedDimensions.width > 0 && 
                   result.croppedDimensions.height > 0 &&
                   result.statistics.retainedPercentage > 0;
    
    results.push({
      testName: "Basic Receipt Detection",
      passed,
      details: `Cropped to ${result.croppedDimensions.width}x${result.croppedDimensions.height}, retained ${result.statistics.retainedPercentage.toFixed(1)}%`,
      outputPath: "imageParser/test_output_basic.jpg",
      dimensions: result.croppedDimensions
    });
    
    console.log(`   ${passed ? "✅" : "❌"} ${results[results.length - 1].details}`);
  } catch (error) {
    results.push({
      testName: "Basic Receipt Detection",
      passed: false,
      details: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 2: Different quality settings
  const qualities = [50, 75, 95];
  for (const quality of qualities) {
    try {
      console.log(`\n📋 Test 2.${quality}: Quality ${quality}% compression`);
      const outputPath = `imageParser/test_output_q${quality}.jpg`;
      
      await runDetector(
        "imageParser/temp_receipt.jpg",
        outputPath,
        quality
      );
      
      // Check file size
      const fileData = await Deno.readFile(outputPath);
      const fileSizeKB = fileData.length / 1024;
      
      results.push({
        testName: `Quality ${quality}% Test`,
        passed: true,
        details: `File size: ${fileSizeKB.toFixed(1)} KB`,
        outputPath,
        fileSize: fileSizeKB
      });
      
      console.log(`   ✅ File size: ${fileSizeKB.toFixed(1)} KB`);
    } catch (error) {
      results.push({
        testName: `Quality ${quality}% Test`,
        passed: false,
        details: `Error: ${error.message}`
      });
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Test 3: Threshold transformation tests
  const thresholdValues = [100, 128, 160];
  for (const threshold of thresholdValues) {
    try {
      console.log(`\n📋 Test 3.${threshold}: Threshold transformation (value: ${threshold})`);
      const outputPath = `imageParser/test_threshold_${threshold}.jpg`;

      const result = await runDetector(
        "imageParser/temp_receipt.jpg",
        outputPath,
        85,
        false, // no sharpening
        1.0,   // sharpening strength
        false, // no contrast
        1.5,   // contrast factor
        true,  // apply threshold
        threshold
      );

      // Check file size
      const fileData = await Deno.readFile(outputPath);
      const fileSizeKB = fileData.length / 1024;

      const passed = result.thresholdApplied && result.croppedDimensions.width > 0;

      results.push({
        testName: `Threshold ${threshold} Test`,
        passed,
        details: `Threshold applied: ${result.thresholdApplied}, File size: ${fileSizeKB.toFixed(1)} KB`,
        outputPath,
        fileSize: fileSizeKB
      });

      console.log(`   ${passed ? "✅" : "❌"} Threshold applied: ${result.thresholdApplied}, File size: ${fileSizeKB.toFixed(1)} KB`);
    } catch (error) {
      results.push({
        testName: `Threshold ${threshold} Test`,
        passed: false,
        details: `Error: ${error.message}`
      });
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Test 4: Contrast enhancement tests
  const contrastFactors = [1.2, 1.8, 2.5];
  for (const factor of contrastFactors) {
    try {
      console.log(`\n📋 Test 4.${factor}: Contrast enhancement (factor: ${factor})`);
      const outputPath = `imageParser/test_contrast_${factor}.jpg`;

      const result = await runDetector(
        "imageParser/temp_receipt.jpg",
        outputPath,
        85,
        false, // no sharpening
        1.0,   // sharpening strength
        true,  // apply contrast
        factor,
        false, // no threshold
        128
      );

      // Check file size
      const fileData = await Deno.readFile(outputPath);
      const fileSizeKB = fileData.length / 1024;

      const passed = result.contrastApplied && result.croppedDimensions.width > 0;

      results.push({
        testName: `Contrast ${factor} Test`,
        passed,
        details: `Contrast applied: ${result.contrastApplied}, File size: ${fileSizeKB.toFixed(1)} KB`,
        outputPath,
        fileSize: fileSizeKB
      });

      console.log(`   ${passed ? "✅" : "❌"} Contrast applied: ${result.contrastApplied}, File size: ${fileSizeKB.toFixed(1)} KB`);
    } catch (error) {
      results.push({
        testName: `Contrast ${factor} Test`,
        passed: false,
        details: `Error: ${error.message}`
      });
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Test 5: Contrast + Threshold combination tests
  try {
    console.log(`\n📋 Test 5: Contrast + Threshold combination`);
    const outputPath = `imageParser/test_contrast_threshold_combo.jpg`;

    const result = await runDetector(
      "imageParser/temp_receipt.jpg",
      outputPath,
      85,
      false, // no sharpening
      1.0,   // sharpening strength
      true,  // apply contrast
      1.8,   // contrast factor
      true,  // apply threshold
      140
    );

    // Check file size
    const fileData = await Deno.readFile(outputPath);
    const fileSizeKB = fileData.length / 1024;

    const passed = result.contrastApplied && result.thresholdApplied && result.croppedDimensions.width > 0;

    results.push({
      testName: `Contrast + Threshold Combo`,
      passed,
      details: `Contrast: ${result.contrastApplied}, Threshold: ${result.thresholdApplied}, File size: ${fileSizeKB.toFixed(1)} KB`,
      outputPath,
      fileSize: fileSizeKB
    });

    console.log(`   ${passed ? "✅" : "❌"} Contrast: ${result.contrastApplied}, Threshold: ${result.thresholdApplied}, File size: ${fileSizeKB.toFixed(1)} KB`);
  } catch (error) {
    results.push({
      testName: `Contrast + Threshold Combo`,
      passed: false,
      details: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 6: Sharpening tests
  console.log("\n🔍 Test 6: Sharpening functionality");
  const sharpeningStrengths = [0.5, 1.0, 1.5, 2.0];

  for (const strength of sharpeningStrengths) {
    try {
      console.log(`\n📋 Test 6.${strength}: Sharpening (strength: ${strength})`);
      const outputPath = `imageParser/test_sharpening_${strength}.jpg`;

      const result = await runDetector(
        "imageParser/temp_receipt.jpg",
        outputPath,
        85,
        true,  // apply sharpening
        strength,
        false, // no contrast
        1.5,   // contrast factor
        false, // no threshold
        128
      );

      const fileStat = await Deno.stat(outputPath);
      const fileSizeKB = fileStat.size / 1024;

      const passed = result.croppedDimensions.width > 0 &&
                     result.croppedDimensions.height > 0 &&
                     fileSizeKB > 0;

      results.push({
        testName: `Sharpening Strength ${strength}`,
        passed,
        details: `Sharpening applied, File size: ${fileSizeKB.toFixed(1)} KB`,
        outputPath,
        fileSize: fileSizeKB
      });

      console.log(`   ${passed ? "✅" : "❌"} Sharpening applied, File size: ${fileSizeKB.toFixed(1)} KB`);
    } catch (error) {
      results.push({
        testName: `Sharpening Strength ${strength}`,
        passed: false,
        details: `Error: ${error.message}`
      });
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Test 7: Full pipeline tests (Sharpening → Contrast → Threshold)
  console.log("\n🔄 Test 7: Full processing pipeline");
  const pipelineTests = [
    { sharpening: true, sharpeningStrength: 1.2, contrast: true, contrastFactor: 1.5, threshold: true, thresholdValue: 140 },
    { sharpening: true, sharpeningStrength: 0.8, contrast: true, contrastFactor: 2.0, threshold: true, thresholdValue: 120 },
    { sharpening: false, sharpeningStrength: 1.0, contrast: true, contrastFactor: 1.8, threshold: true, thresholdValue: 160 }
  ];

  for (let i = 0; i < pipelineTests.length; i++) {
    const test = pipelineTests[i];
    try {
      console.log(`\n📋 Test 7.${i + 1}: Pipeline - Sharpening:${test.sharpening}(${test.sharpeningStrength}) → Contrast:${test.contrast}(${test.contrastFactor}) → Threshold:${test.threshold}(${test.thresholdValue})`);
      const outputPath = `imageParser/test_pipeline_${i + 1}.jpg`;

      const result = await runDetector(
        "imageParser/temp_receipt.jpg",
        outputPath,
        85,
        test.sharpening,
        test.sharpeningStrength,
        test.contrast,
        test.contrastFactor,
        test.threshold,
        test.thresholdValue
      );

      const fileStat = await Deno.stat(outputPath);
      const fileSizeKB = fileStat.size / 1024;

      const passed = result.croppedDimensions.width > 0 &&
                     result.croppedDimensions.height > 0 &&
                     fileSizeKB > 0;

      results.push({
        testName: `Full Pipeline ${i + 1}`,
        passed,
        details: `S:${test.sharpening ? test.sharpeningStrength : 'off'} C:${test.contrast ? test.contrastFactor : 'off'} T:${test.threshold ? test.thresholdValue : 'off'}, Size: ${fileSizeKB.toFixed(1)} KB`,
        outputPath,
        fileSize: fileSizeKB
      });

      console.log(`   ${passed ? "✅" : "❌"} Pipeline complete, File size: ${fileSizeKB.toFixed(1)} KB`);
    } catch (error) {
      results.push({
        testName: `Full Pipeline ${i + 1}`,
        passed: false,
        details: `Error: ${error.message}`
      });
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Test 8: Test with different receipt images if available
  const testImages = ["imageParser/SPAR.jpg", "imageParser/ss.jpg"];
  
  for (let i = 0; i < testImages.length; i++) {
    const imagePath = testImages[i];
    try {
      // Check if file exists
      await Deno.stat(imagePath);

      console.log(`\n📋 Test 6.${i + 1}: Different receipt image (${imagePath})`);
      const outputPath = `imageParser/test_output_${i + 1}.jpg`;

      const result = await runDetector(imagePath, outputPath, 85);

      const passed = result.croppedDimensions.width > 0 &&
                     result.croppedDimensions.height > 0;

      results.push({
        testName: `Different Receipt ${i + 1}`,
        passed,
        details: `${imagePath} -> ${result.croppedDimensions.width}x${result.croppedDimensions.height}`,
        outputPath,
        dimensions: result.croppedDimensions
      });

      console.log(`   ${passed ? "✅" : "❌"} ${results[results.length - 1].details}`);
    } catch (error) {
      if (error.name === "NotFound") {
        console.log(`   ⏭️  Skipping ${imagePath} (file not found)`);
      } else {
        results.push({
          testName: `Different Receipt ${i + 1}`,
          passed: false,
          details: `Error with ${imagePath}: ${error.message}`
        });
        console.log(`   ❌ Error with ${imagePath}: ${error.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Print test summary
 */
function printSummary(results: TestResult[]) {
  console.log("\n" + "=" .repeat(50));
  console.log("📊 TEST SUMMARY");
  console.log("=" .repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
  
  console.log("\n📋 Detailed Results:");
  results.forEach((result, index) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`   ${index + 1}. ${status} - ${result.testName}`);
    console.log(`      ${result.details}`);
    if (result.outputPath) {
      console.log(`      Output: ${result.outputPath}`);
    }
  });
  
  if (passed === total) {
    console.log("\n🎉 All tests passed! The white receipt detector is working correctly.");
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed. Please review the issues above.`);
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  try {
    const results = await runTests();
    printSummary(results);
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
    Deno.exit(1);
  }
}

export { runTests, printSummary };
