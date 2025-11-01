import {Image} from "jsr:@matmen/imagescript";

async function removeWhiteBorders(inputPath: string, outputPath: string) {
  const imageData = await Deno.readFile(inputPath);
  const image = await Image.decode(imageData);

  const WHITE_THRESHOLD = 230;
  const PIXEL_TOLERANCE = 0.95;
  const MAX_BORDER_RATIO = 0.3;

  const { width, height } = image;

  if (width === 0 || height === 0) {
    throw new Error("Image has zero dimensions");
  }

  // Helper function to safely get pixel with boundary checks
  function safeGetPixel(x: number, y: number): number {
    // Convert to 1-based indexing and check boundaries
    const pixelX = x + 1;
    const pixelY = y + 1;

    if (pixelX < 1 || pixelX > width || pixelY < 1 || pixelY > height) {
      // Return white pixel (0xFFFFFFFF) for out-of-bounds access
      return 0xFFFFFFFF;
    }

    return image.getPixelAt(pixelX, pixelY);
  }

  const topBorderLimit = Math.floor(height * MAX_BORDER_RATIO);
  const bottomBorderStart = Math.max(0, height - topBorderLimit);
  const sideBorderLimit = Math.floor(width * MAX_BORDER_RATIO);

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  // Detect top border
  // Note: ImageScript uses 1-based indexing for getPixelAt()
  topBorderScan:
  for (let y = 0; y < topBorderLimit; y++) {
    let whiteCount = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;

      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / width < PIXEL_TOLERANCE) break topBorderScan;
    top = y + 1;
  }

  // Detect bottom border
  bottomBorderScan:
  for (let y = height - 1; y >= bottomBorderStart; y--) {
    let whiteCount = 0;
    for (let x = 0; x < width; x++) {
      const rgba = safeGetPixel(x, y);
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;

      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / width < PIXEL_TOLERANCE) break bottomBorderScan;
    bottom = y - 1;
  }

  top = Math.min(top, height - 1);
  bottom = Math.max(bottom, top);
  const contentHeight = bottom - top + 1;

  // Detect left border
  leftBorderScan:
  for (let x = 0; x < sideBorderLimit; x++) {
    let whiteCount = 0;
    for (let y = top; y <= bottom; y++) {
      const rgba = image.getPixelAt(x + 1, y + 1); // Convert to 1-based indexing
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;

      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / contentHeight < PIXEL_TOLERANCE) break leftBorderScan;
    left = x + 1;
  }

  // Detect right border
  rightBorderScan:
  for (let x = width - 1; x >= width - sideBorderLimit; x--) {
    let whiteCount = 0;
    for (let y = top; y <= bottom; y++) {
      const rgba = image.getPixelAt(x + 1, y + 1); // Convert to 1-based indexing
      const r = (rgba >>> 24) & 0xFF;
      const g = (rgba >>> 16) & 0xFF;
      const b = (rgba >>> 8) & 0xFF;

      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        whiteCount++;
      }
    }
    if (whiteCount / contentHeight < PIXEL_TOLERANCE) break rightBorderScan;
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
}

// Usage remains the same
removeWhiteBorders("SPAR.jpg", "output.jpg")
  .then(() => console.log("Border removal complete!"))
  .catch(console.error);