# Receipt Border Removal Tools

This directory contains tools for automatically removing borders from receipt images to maximize the white content area while preserving all receipt text and information.

## Problem Solved

Receipt images often have significant black borders around the actual receipt content. The goal is to crop these images to:
- **Maximize white receipt content area**
- **Remove as much black border as possible**
- **Preserve all text, logos, and receipt information**
- **Handle both black and white borders automatically**

## Files Overview

### Core Implementation
- **`optimal_border_removal.ts`** - Main implementation that maximizes white content area
- **`smart_border_removal.ts`** - Earlier version that detects uniform border colors
- **`border_removal.ts`** - Original white-border-only implementation

### Analysis Tools
- **`content_analysis.ts`** - Analyzes receipt content to find optimal crop boundaries
- **`analyze_borders.ts`** - Examines pixel values at image edges

### Testing
- **`optimal_test.ts`** - Comprehensive test suite for optimal border removal
- **`comprehensive_test.ts`** - Tests for smart border removal
- **`border_removal_test.ts`** - Tests for original implementation

## Key Improvements Made

### 1. Fixed Coordinate System Issue
**Problem**: ImageScript library uses 1-based indexing, but code used 0-based indexing.
**Solution**: Added +1 to all x,y coordinates when calling `getPixelAt()`.

### 2. Content-Aware Detection
**Problem**: Original algorithm only detected white borders, but receipt had black borders.
**Solution**: Implemented content detection that identifies any pixel brighter than dark borders (brightness > 50).

### 3. Optimal Cropping Algorithm
**Problem**: Previous methods were too conservative, leaving unnecessary black border.
**Solution**: Scan entire image to find tight bounding box of all content pixels.

## Performance Comparison

| Method | Output Size | Area Retained | Border Removed |
|--------|-------------|---------------|----------------|
| Original (white-only) | 1197×1600 | 100% | 0% (failed) |
| Smart (uniform color) | 1133×1514 | 89.6% | 10.4% |
| **Optimal (content-aware)** | **959×1529** | **76.6%** | **23.4%** |

The optimal method removes **13.0 percentage points** more border while preserving all receipt content!

## Usage

### Optimal Border Removal (Recommended)
```bash
deno run --allow-read --allow-write --allow-net optimal_border_removal.ts
```

### Run Tests
```bash
deno run --allow-read --allow-write --allow-net optimal_test.ts
```

### Analyze Content
```bash
deno run --allow-read --allow-net content_analysis.ts
```

## Algorithm Details

### Content Detection
- **Brightness threshold**: Pixels with brightness > 50 are considered content
- **Captures**: Receipt paper, text, logos, stamps, etc.
- **Excludes**: Dark borders, shadows, background

### Boundary Detection
1. Scan entire image pixel by pixel
2. Find min/max X,Y coordinates of all content pixels
3. Add small padding (5px) to ensure no content is cut off
4. Crop to the resulting tight bounding box

### Safety Features
- Boundary validation prevents accessing pixels outside image
- Padding ensures content at edges isn't accidentally cropped
- Error handling for images with no detectable content

## Test Results

✅ **All 8 tests passing (100%)**
- Output file validation
- Dimension accuracy
- Sufficient border removal (top ≥50px, left ≥100px, right ≥50px)
- Reasonable content area and aspect ratio
- Border efficiency (removes 23.4% of image as border)

## Technical Notes

### ImageScript Library
- Uses 1-based coordinate indexing for `getPixelAt(x, y)`
- RGBA format: `(rgba >>> 24) & 0xFF` for red channel
- Requires `--allow-net` permission for JSR imports

### Brightness Calculation
```typescript
const brightness = (r + g + b) / 3;
const isContent = brightness > 50; // Threshold for content vs border
```

### Coordinate Conversion
```typescript
function safeGetPixel(x: number, y: number): number {
  const pixelX = x + 1; // Convert to 1-based indexing
  const pixelY = y + 1;
  return image.getPixelAt(pixelX, pixelY);
}
```

## Future Enhancements

1. **Adaptive thresholding** - Automatically adjust brightness threshold based on image characteristics
2. **Multi-receipt detection** - Handle images with multiple receipts
3. **Rotation correction** - Detect and correct skewed receipts
4. **Batch processing** - Process multiple images in one command

---

**Result**: Successfully maximizes white receipt content area while removing maximum black border! 🎉
