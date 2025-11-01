import {Image} from "jsr:@matmen/imagescript";

async function removeUniformBorders(inputPath: string, outputPath: string) {
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);
  
  const PIXEL_TOLERANCE = 0.95; // 95% of pixels must be uniform
  const MAX_BORDER_RATIO = 0.3; // Don't remove more than 30% of image
  const COLOR_VARIANCE_THRESHOLD = 15; // Allow small variance in RGB values

  const { width, height } = image;
  
  if (width === 0 || height === 0) {
    throw new Error("Image has zero dimensions");
  }

  // Helper function to safely get pixel with boundary checks
  function safeGetPixel(x: number, y: number): number {
    const pixelX = x + 1;
    const pixelY = y + 1;
    
    if (pixelX < 1 || pixelX > width || pixelY < 1 || pixelY > height) {
      return 0x00000000; // Return black for out-of-bounds
    }
    
    return image.getPixelAt(pixelX, pixelY);
  }

  // Function to check if a pixel is similar to a reference color
  function isColorSimilar(rgba: number, refR: number, refG: number, refB: number): boolean {
    const r = (rgba >>> 24) & 0xFF;
    const g = (rgba >>> 16) & 0xFF;
    const b = (rgba >>> 8) & 0xFF;
    
    return Math.abs(r - refR) <= COLOR_VARIANCE_THRESHOLD &&
           Math.abs(g - refG) <= COLOR_VARIANCE_THRESHOLD &&
           Math.abs(b - refB) <= COLOR_VARIANCE_THRESHOLD;
  }

  // Detect the border color by sampling corner pixels
  function detectBorderColor(): {r: number, g: number, b: number} {
    const corners = [
      safeGetPixel(0, 0), // top-left
      safeGetPixel(width - 1, 0), // top-right
      safeGetPixel(0, height - 1), // bottom-left
      safeGetPixel(width - 1, height - 1) // bottom-right
    ];
    
    // Use the most common corner color as border color
    const cornerColors = corners.map(rgba => ({
      r: (rgba >>> 24) & 0xFF,
      g: (rgba >>> 16) & 0xFF,
      b: (rgba >>> 8) & 0xFF
    }));
    
    // For simplicity, use the top-left corner color
    return cornerColors[0];
  }

  const borderColor = detectBorderColor();
  console.log(`🎨 Detected border color: RGB(${borderColor.r}, ${borderColor.g}, ${borderColor.b})`);

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

  // Detect bottom border
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

  // Detect left border
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

  // Detect right border
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

  console.log(`✂️  Borders detected: top=${top}, bottom=${height - 1 - bottom}, left=${left}, right=${width - 1 - right}`);
  console.log(`📏 Content area: ${contentWidth}x${contentHeight} (${((contentWidth * contentHeight) / (width * height) * 100).toFixed(1)}% of original)`);

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

// Usage
if (import.meta.main) {
  removeUniformBorders("SPAR.jpg", "smart_output.jpg")
    .then((result) => {
      console.log("🎉 Smart border removal complete!");
      console.log(`📊 Original: ${result.originalDimensions.width}x${result.originalDimensions.height}`);
      console.log(`📊 Cropped: ${result.croppedDimensions.width}x${result.croppedDimensions.height}`);
    })
    .catch(console.error);
}
