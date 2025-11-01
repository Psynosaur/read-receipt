import {Image} from "jsr:@matmen/imagescript";

async function testCompressionOptions() {
  console.log("🔍 Testing ImageScript compression options...");
  
  // Load a test image
  const imageData = await Deno.readFile("ss.jpg");
  const image = await Image.decode(imageData);
  
  console.log(`📏 Original image: ${image.width}x${image.height}`);
  
  // Test default encoding
  console.log("\n1. Testing default encode():");
  const defaultOutput = await image.encode();
  console.log(`   Default size: ${defaultOutput.length} bytes`);
  
  // Test if encode accepts quality parameter
  console.log("\n2. Testing encode with quality parameter:");
  try {
    const qualityOutput = await image.encode(80);
    console.log(`   Quality 80 size: ${qualityOutput.length} bytes`);
  } catch (error) {
    console.log(`   Quality parameter not supported: ${error.message}`);
  }
  
  // Test if encode accepts options object
  console.log("\n3. Testing encode with options object:");
  try {
    const optionsOutput = await image.encode({ quality: 80 });
    console.log(`   Options quality 80 size: ${optionsOutput.length} bytes`);
  } catch (error) {
    console.log(`   Options object not supported: ${error.message}`);
  }
  
  // Test different format encodings
  console.log("\n4. Testing different format methods:");
  
  // Test encodeJPEG if it exists
  try {
    const jpegOutput = await (image as any).encodeJPEG();
    console.log(`   encodeJPEG() size: ${jpegOutput.length} bytes`);
  } catch (error) {
    console.log(`   encodeJPEG() not available: ${error.message}`);
  }
  
  // Test encodeJPEG with quality
  try {
    const jpegQualityOutput = await (image as any).encodeJPEG(80);
    console.log(`   encodeJPEG(80) size: ${jpegQualityOutput.length} bytes`);
  } catch (error) {
    console.log(`   encodeJPEG(quality) not available: ${error.message}`);
  }
  
  // Test encodePNG
  try {
    const pngOutput = await (image as any).encodePNG();
    console.log(`   encodePNG() size: ${pngOutput.length} bytes`);
  } catch (error) {
    console.log(`   encodePNG() not available: ${error.message}`);
  }
  
  // Check what methods are available on the image object
  console.log("\n5. Available methods on Image object:");
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(image))
    .filter(name => typeof (image as any)[name] === 'function')
    .filter(name => name.includes('encode') || name.includes('compress'));
  
  console.log(`   Encoding-related methods: ${methods.join(', ')}`);
  
  // Check static methods
  console.log("\n6. Available static methods on Image class:");
  const staticMethods = Object.getOwnPropertyNames(Image)
    .filter(name => typeof (Image as any)[name] === 'function')
    .filter(name => name.includes('encode') || name.includes('compress'));
  
  console.log(`   Static encoding methods: ${staticMethods.join(', ')}`);
  
  // Test file size comparison
  const originalFileSize = (await Deno.stat("ss.jpg")).size;
  console.log(`\n📊 Size comparison:`);
  console.log(`   Original file: ${originalFileSize} bytes`);
  console.log(`   Default encode: ${defaultOutput.length} bytes`);
  console.log(`   Compression ratio: ${((defaultOutput.length / originalFileSize) * 100).toFixed(1)}%`);
}

if (import.meta.main) {
  testCompressionOptions().catch(console.error);
}
