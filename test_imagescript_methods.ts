import {Image} from "jsr:@matmen/imagescript";

async function exploreImageScriptMethods() {
  console.log("🔍 Exploring ImageScript methods...");
  
  try {
    // Load a test image
    const imageData = await Deno.readFile("ss.jpg");
    const image = await Image.decode(imageData);
    
    console.log(`📏 Original image: ${image.width}x${image.height}`);
    
    // List all available methods and properties
    console.log("\n📋 Available methods and properties:");
    const proto = Object.getPrototypeOf(image);
    const methods = Object.getOwnPropertyNames(proto);
    
    methods.forEach(method => {
      if (typeof (image as any)[method] === 'function') {
        console.log(`  🔧 Method: ${method}`);
      } else {
        console.log(`  📊 Property: ${method}`);
      }
    });
    
    // Check for resize-related methods
    console.log("\n🔍 Checking for resize-related methods:");
    const resizeMethods = methods.filter(m => 
      m.toLowerCase().includes('resize') || 
      m.toLowerCase().includes('scale') || 
      m.toLowerCase().includes('size')
    );
    
    if (resizeMethods.length > 0) {
      console.log("  ✅ Found resize-related methods:");
      resizeMethods.forEach(method => console.log(`    - ${method}`));
    } else {
      console.log("  ❌ No resize-related methods found");
    }
    
    // Test if resize method exists
    console.log("\n🧪 Testing resize method existence:");
    if ('resize' in image && typeof (image as any).resize === 'function') {
      console.log("  ✅ resize() method exists!");
      
      // Try to use it
      try {
        const resized = image.clone();
        (resized as any).resize(896, 896);
        console.log(`  ✅ resize() works! New size: ${resized.width}x${resized.height}`);
      } catch (error) {
        console.log(`  ❌ resize() failed: ${error.message}`);
      }
    } else {
      console.log("  ❌ resize() method not found");
    }
    
    // Test if scale method exists
    console.log("\n🧪 Testing scale method existence:");
    if ('scale' in image && typeof (image as any).scale === 'function') {
      console.log("  ✅ scale() method exists!");
      
      // Try to use it
      try {
        const scaled = image.clone();
        (scaled as any).scale(0.5);
        console.log(`  ✅ scale() works! New size: ${scaled.width}x${scaled.height}`);
      } catch (error) {
        console.log(`  ❌ scale() failed: ${error.message}`);
      }
    } else {
      console.log("  ❌ scale() method not found");
    }
    
    // Check constructor and static methods
    console.log("\n🏗️ Checking Image constructor and static methods:");
    const ImageConstructor = image.constructor as any;
    const staticMethods = Object.getOwnPropertyNames(ImageConstructor);
    
    staticMethods.forEach(method => {
      if (typeof ImageConstructor[method] === 'function') {
        console.log(`  🔧 Static method: ${method}`);
      }
    });
    
  } catch (error) {
    console.error("❌ Error exploring ImageScript methods:", error.message);
  }
}

// Run the exploration
if (import.meta.main) {
  exploreImageScriptMethods();
}
