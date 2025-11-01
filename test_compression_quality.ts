/**
 * Test suite for compression quality verification
 * Tests different quality levels and ensures acceptable output
 */

interface CompressionTestResult {
  testName: string;
  quality: number;
  fileSize: number;
  fileSizeKB: number;
  passed: boolean;
  details: string;
}

/**
 * Test compression with different quality levels
 */
async function testCompressionQuality(imagePath: string): Promise<CompressionTestResult[]> {
  console.log("🧪 Testing compression quality levels...\n");
  
  const results: CompressionTestResult[] = [];
  const qualityLevels = [75, 85, 95];
  
  for (const quality of qualityLevels) {
    const testName = `Quality ${quality} test`;
    const outputPath = `test_compression_q${quality}.jpg`;
    
    try {
      // Run the detector with specific quality
      const process = new Deno.Command("deno", {
        args: ["run", "--allow-read", "--allow-write", "--allow-net", "white_receipt_detector.ts", imagePath, outputPath, quality.toString()],
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code, stdout, stderr } = await process.output();
      
      if (code !== 0) {
        results.push({
          testName,
          quality,
          fileSize: 0,
          fileSizeKB: 0,
          passed: false,
          details: `Process failed: ${new TextDecoder().decode(stderr)}`
        });
        continue;
      }
      
      // Check output file
      const stat = await Deno.stat(outputPath);
      const fileSizeKB = stat.size / 1024;
      
      // Parse output for verification
      const output = new TextDecoder().decode(stdout);
      const qualityMatch = output.match(/🗜️  JPEG quality: (\d+)% \(file size: ([\d.]+) KB\)/);
      
      let passed = true;
      let details = "";
      
      if (!qualityMatch) {
        passed = false;
        details = "Quality information not found in output";
      } else {
        const reportedQuality = parseInt(qualityMatch[1]);
        const reportedSize = parseFloat(qualityMatch[2]);
        
        if (reportedQuality !== quality) {
          passed = false;
          details = `Quality mismatch: expected ${quality}, got ${reportedQuality}`;
        } else if (Math.abs(reportedSize - fileSizeKB) > 1) {
          passed = false;
          details = `Size mismatch: expected ~${fileSizeKB.toFixed(1)} KB, reported ${reportedSize} KB`;
        } else {
          details = `✅ Quality ${quality}% produces ${fileSizeKB.toFixed(1)} KB file`;
        }
      }
      
      // Quality-specific checks
      if (passed) {
        if (quality === 75 && fileSizeKB > 100) {
          details += " (⚠️  larger than expected for quality 75)";
        } else if (quality === 95 && fileSizeKB < 150) {
          details += " (⚠️  smaller than expected for quality 95)";
        }
      }
      
      results.push({
        testName,
        quality,
        fileSize: stat.size,
        fileSizeKB,
        passed,
        details
      });
      
      // Clean up
      try {
        await Deno.remove(outputPath);
      } catch {
        // Ignore cleanup errors
      }
      
    } catch (error) {
      results.push({
        testName,
        quality,
        fileSize: 0,
        fileSizeKB: 0,
        passed: false,
        details: `Test failed: ${error.message}`
      });
    }
  }
  
  return results;
}

/**
 * Test that compression maintains reasonable file sizes
 */
async function testCompressionEfficiency(): Promise<boolean> {
  console.log("📊 Testing compression efficiency...");
  
  // Test with a known image
  const results = await testCompressionQuality("ss.jpg");
  
  // Check that quality 75 < quality 85 < quality 95 in file size
  const q75 = results.find(r => r.quality === 75);
  const q85 = results.find(r => r.quality === 85);
  const q95 = results.find(r => r.quality === 95);
  
  if (!q75 || !q85 || !q95) {
    console.log("❌ Missing quality test results");
    return false;
  }
  
  if (q75.fileSize >= q85.fileSize || q85.fileSize >= q95.fileSize) {
    console.log("❌ File sizes not in expected order (75 < 85 < 95)");
    console.log(`   Q75: ${q75.fileSizeKB.toFixed(1)} KB`);
    console.log(`   Q85: ${q85.fileSizeKB.toFixed(1)} KB`);
    console.log(`   Q95: ${q95.fileSizeKB.toFixed(1)} KB`);
    return false;
  }
  
  // Check that compression is significant (quality 85 should be < 200 KB for typical receipt)
  if (q85.fileSizeKB > 200) {
    console.log(`⚠️  Quality 85 file size (${q85.fileSizeKB.toFixed(1)} KB) larger than expected`);
  }
  
  console.log("✅ Compression efficiency test passed");
  console.log(`   Quality 75: ${q75.fileSizeKB.toFixed(1)} KB`);
  console.log(`   Quality 85: ${q85.fileSizeKB.toFixed(1)} KB (default)`);
  console.log(`   Quality 95: ${q95.fileSizeKB.toFixed(1)} KB`);
  
  return true;
}

/**
 * Main test runner
 */
async function runCompressionTests() {
  console.log("🧪 Starting Compression Quality Tests\n");
  
  const results = await testCompressionQuality("ss.jpg");
  const efficiencyPassed = await testCompressionEfficiency();
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 COMPRESSION TEST RESULTS");
  console.log("=".repeat(60));
  
  let passedCount = 0;
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.testName}`);
    console.log(`     ${result.details}`);
    if (result.passed) passedCount++;
  }
  
  console.log(`\n📈 Results: ${passedCount}/${results.length} quality tests passed`);
  console.log(`📈 Efficiency test: ${efficiencyPassed ? "PASSED" : "FAILED"}`);
  
  if (passedCount === results.length && efficiencyPassed) {
    console.log("🎉 All compression tests passed!");
    console.log("\n💡 Recommendations:");
    console.log("   - Use quality 85 (default) for balanced compression");
    console.log("   - Use quality 75 for maximum compression");
    console.log("   - Use quality 95 for highest quality");
  } else {
    console.log("⚠️  Some compression tests failed. Please review the results above.");
  }
  
  return { qualityTests: results, efficiencyPassed };
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runCompressionTests().catch(console.error);
}

export { runCompressionTests, testCompressionQuality, testCompressionEfficiency };
