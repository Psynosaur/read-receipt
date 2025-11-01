import {Image} from "jsr:@matmen/imagescript";

async function testCompressionComparison() {
  console.log("🔍 Testing compression comparison...");
  
  // Load a test image
  const imageData = await Deno.readFile("ss.jpg");
  const image = await Image.decode(imageData);
  
  console.log(`📏 Test image: ${image.width}x${image.height}`);
  
  // Create a cropped version for testing (simulate the white receipt detector output)
  const croppedImage = image.clone();
  croppedImage.crop(598, 0, 411, 1271); // Using the same crop as the detector
  
  console.log(`📏 Cropped image: ${croppedImage.width}x${croppedImage.height}`);
  
  // Test different compression methods
  console.log("\n📊 Compression comparison:");
  
  // 1. Default encode (PNG-like)
  const defaultOutput = await croppedImage.encode();
  await Deno.writeFile("test_default.jpg", defaultOutput);
  console.log(`   Default encode(): ${defaultOutput.length} bytes`);
  
  // 2. encode with quality 85
  const quality85Output = await croppedImage.encode(85);
  await Deno.writeFile("test_quality85.jpg", quality85Output);
  console.log(`   encode(85): ${quality85Output.length} bytes`);
  
  // 3. encodeJPEG default
  const jpegOutput = await croppedImage.encodeJPEG();
  await Deno.writeFile("test_jpeg.jpg", jpegOutput);
  console.log(`   encodeJPEG(): ${jpegOutput.length} bytes`);
  
  // 4. encodeJPEG with quality 85
  const jpeg85Output = await croppedImage.encodeJPEG(85);
  await Deno.writeFile("test_jpeg85.jpg", jpeg85Output);
  console.log(`   encodeJPEG(85): ${jpeg85Output.length} bytes`);
  
  // 5. encodeJPEG with quality 90 (higher quality)
  const jpeg90Output = await croppedImage.encodeJPEG(90);
  await Deno.writeFile("test_jpeg90.jpg", jpeg90Output);
  console.log(`   encodeJPEG(90): ${jpeg90Output.length} bytes`);
  
  // 6. encodeJPEG with quality 75 (more compression)
  const jpeg75Output = await croppedImage.encodeJPEG(75);
  await Deno.writeFile("test_jpeg75.jpg", jpeg75Output);
  console.log(`   encodeJPEG(75): ${jpeg75Output.length} bytes`);
  
  // Calculate compression ratios
  console.log("\n📈 Compression ratios (vs default encode):");
  console.log(`   encode(85): ${((quality85Output.length / defaultOutput.length) * 100).toFixed(1)}%`);
  console.log(`   encodeJPEG(): ${((jpegOutput.length / defaultOutput.length) * 100).toFixed(1)}%`);
  console.log(`   encodeJPEG(85): ${((jpeg85Output.length / defaultOutput.length) * 100).toFixed(1)}%`);
  console.log(`   encodeJPEG(90): ${((jpeg90Output.length / defaultOutput.length) * 100).toFixed(1)}%`);
  console.log(`   encodeJPEG(75): ${((jpeg75Output.length / defaultOutput.length) * 100).toFixed(1)}%`);
  
  // Recommend best option
  console.log("\n💡 Recommendations:");
  console.log("   - encodeJPEG(85): Good balance of quality and compression");
  console.log("   - encodeJPEG(90): Higher quality, moderate compression");
  console.log("   - encodeJPEG(75): Maximum compression, acceptable quality");
  
  // Clean up test files
  const testFiles = [
    "test_default.jpg",
    "test_quality85.jpg", 
    "test_jpeg.jpg",
    "test_jpeg85.jpg",
    "test_jpeg90.jpg",
    "test_jpeg75.jpg"
  ];
  
  for (const file of testFiles) {
    try {
      await Deno.remove(file);
    } catch {
      // Ignore cleanup errors
    }
  }
  
  console.log("\n✅ Compression test complete!");
  return {
    defaultSize: defaultOutput.length,
    jpeg85Size: jpeg85Output.length,
    compressionRatio: (jpeg85Output.length / defaultOutput.length) * 100
  };
}

if (import.meta.main) {
  testCompressionComparison().catch(console.error);
}
