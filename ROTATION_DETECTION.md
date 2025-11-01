# Receipt Rotation Detection and Correction

## Overview

The white receipt detector now includes automatic rotation detection and correction functionality. This feature analyzes the orientation of text and edges within the detected white receipt area and automatically rotates the image to a normal reading angle before cropping.

## How It Works

### 1. Edge Gradient Analysis

The rotation detection uses Sobel edge detection to analyze gradients within the white receipt area:

- **Sobel Operators**: Applied to detect horizontal and vertical edges
- **Gradient Calculation**: Computes magnitude and angle of edges
- **Sampling**: Uses a subset of white area points for performance
- **Threshold**: Only considers edges with magnitude > 10 for noise reduction

### 2. Dominant Angle Detection

The algorithm identifies the dominant text/edge orientation:

- **Angle Binning**: Groups similar angles into 2-degree bins
- **Weight Accumulation**: Weights angles by their edge magnitude
- **Normalization**: Converts angles to 0-180° range for line orientation
- **Peak Detection**: Finds the angle bin with highest accumulated weight

### 3. Rotation Calculation

Converts the dominant edge angle to the required rotation:

- **Rotation Angle**: Calculated as negative of dominant angle
- **Near-180° Handling**: Angles > 170° are treated as small negative angles (e.g., 178° → -2°)
- **Near-0° Handling**: Angles < 10° are treated as small positive angles
- **Range Limiting**: Constrains rotation to ±45° range
- **Large Rotation Rejection**: Rotations > 75° are rejected as likely misdetections
- **Confidence**: Based on how dominant the peak angle is vs. total

### 4. Rotation Application

Applies the correction if confidence and angle thresholds are met:

- **Minimum Confidence**: 0.02 (2% of total edge weight)
- **Minimum Angle**: 2 degrees
- **ImageScript Rotation**: Uses built-in rotation with resize=true
- **Area Recalculation**: Finds white area again after rotation

## Configuration

### Thresholds

```typescript
const MIN_CONFIDENCE = 0.02; // Minimum confidence to apply rotation
const MIN_ANGLE = 2;          // Minimum angle (degrees) to apply rotation
```

### Edge Detection Parameters

```typescript
const sampleStep = Math.max(1, Math.floor(Math.sqrt(whiteAreaPoints.length) / 50));
const magnitudeThreshold = 10; // Minimum edge magnitude
const binSize = 2;             // Angle bin size in degrees
```

## Usage

The rotation detection is automatically integrated into the main detection function:

```bash
deno run --allow-read --allow-write --allow-net white_receipt_detector.ts input.jpg output.jpg [quality]
```

### Parameters
- `input.jpg`: Input image path
- `output.jpg`: Output image path (optional, defaults to `input_output.jpg`)
- `quality`: JPEG quality 1-100 (optional, defaults to 85)

### Compression Examples
```bash
# Default quality (85) - balanced compression
deno run --allow-read --allow-write --allow-net white_receipt_detector.ts receipt.jpg

# Maximum compression (quality 75)
deno run --allow-read --allow-write --allow-net white_receipt_detector.ts receipt.jpg output.jpg 75

# Highest quality (quality 95)
deno run --allow-read --allow-write --allow-net white_receipt_detector.ts receipt.jpg output.jpg 95
```

### Output Information

The detector provides detailed logging about rotation:

```
🔄 Detecting rotation angle...
   Found 11980 edge gradients
   Dominant angle: 46°, Rotation needed: 44°, Confidence: 0.05
🔄 Applying rotation correction: 44.0° (confidence: 0.05)
```

Or if rotation is skipped:

```
⏭️  Skipping rotation: angle=44.0°, confidence=0.01
```

## Return Value Enhancement

The function now returns rotation information:

```typescript
interface RotationResult {
  angle: number;      // Rotation angle applied (degrees)
  confidence: number; // Confidence score (0-1)
  method: string;     // Detection method used
}

// Added to return value
return {
  // ... existing fields
  rotation: rotationResult,
  // ... rest of fields
};
```

## Testing

Comprehensive tests are available in multiple test files:

### Rotation Fix Tests
```bash
deno run --allow-read --allow-write --allow-run test_rotation_fix.ts
```

### Original Rotation Detection Tests
```bash
deno run --allow-read --allow-write --allow-run test_rotation_detection.ts
```

### Test Coverage

- **Rotation Detection**: Tests with known rotated images
- **Consistency**: Verifies consistent results across multiple runs
- **Angle Accuracy**: Validates detected angles within tolerance
- **Confidence Validation**: Ensures appropriate confidence scores
- **Fix Validation**: Ensures ss.jpg no longer gets incorrectly rotated 90°
- **Regression Testing**: Verifies existing functionality still works correctly
- **Compression Quality**: Tests different JPEG quality levels and file sizes

### Compression Quality Tests
```bash
deno run --allow-read --allow-write --allow-run test_compression_quality.ts
```

## Performance Considerations

### Optimizations

- **Sampling**: Only processes a subset of white area points
- **Early Exit**: Skips rotation if insufficient edges found
- **Efficient Binning**: Uses simple angle binning for speed
- **Memory Management**: Processes edges in streaming fashion

### Computational Complexity

- **Edge Detection**: O(n) where n is sampled points
- **Angle Analysis**: O(m) where m is number of significant edges
- **Rotation**: O(w×h) where w,h are image dimensions

## Limitations

### Current Constraints

- **Text-Based**: Works best with text-heavy receipts
- **Angle Range**: Limited to ±45° rotations
- **Confidence Threshold**: May miss subtle rotations
- **Single Orientation**: Assumes uniform text orientation

### Future Improvements

- **Multi-Scale Analysis**: Analyze at different resolutions
- **Text Line Detection**: Use more sophisticated text detection
- **Machine Learning**: Train a rotation classifier
- **Perspective Correction**: Handle perspective distortion

## Troubleshooting

### Low Confidence Issues

If rotation isn't being applied when expected:

1. **Lower Threshold**: Reduce `MIN_CONFIDENCE` value
2. **Check Image Quality**: Ensure clear text/edges
3. **Verify White Area**: Confirm receipt area is properly detected
4. **Review Logs**: Check edge gradient count and dominant angles

### Incorrect Rotation

If wrong rotation is applied:

1. **Increase Confidence**: Raise `MIN_CONFIDENCE` threshold
2. **Adjust Bin Size**: Modify angle binning resolution
3. **Filter Noise**: Increase edge magnitude threshold
4. **Sample More Points**: Reduce sampling step size

## Examples

### Successful Rotation Detection

```
Input: oh.jpg (rotated ~45°)
Output: Detected 44° rotation, applied correction
Result: Receipt oriented for normal reading
```

### Skipped Rotation

```
Input: straight_receipt.jpg
Output: Detected 1° rotation, skipped (below threshold)
Result: No unnecessary rotation applied
```

## Bug Fix: 90-Degree Rotation Issue

### Problem
Previously, images with dominant edge angles near 180° (e.g., 178°) were incorrectly rotated by approximately 90 degrees. This happened because:

1. A 178° angle was treated as requiring a -178° rotation
2. The normalization logic would add 90° to bring it into range: -178° + 90° = -88°
3. This resulted in an unwanted ~90° rotation

### Solution
The fix handles angles near 180° specially:

- **Angles > 170°**: Treated as small negative rotations (178° → 2° correction)
- **Angles < 10°**: Treated as small positive rotations
- **Large rotations > 75°**: Rejected as likely misdetections

### Example Fix
```
Before: ss.jpg → 178° dominant angle → -88° rotation (wrong)
After:  ss.jpg → 178° dominant angle → 2° rotation (correct)
```

This ensures that nearly horizontal receipts don't get rotated 90 degrees unnecessarily.

## Output Compression

### JPEG Compression
The detector now uses JPEG compression to significantly reduce output file sizes:

- **Default Quality**: 85% (balanced compression and quality)
- **File Size Reduction**: Typically 85-95% smaller than uncompressed PNG
- **Quality Options**: 1-100 (higher = better quality, larger file)

### Compression Results
Typical file size comparison for a cropped receipt:
- **Uncompressed**: ~900 KB
- **Quality 75**: ~80 KB (92% reduction)
- **Quality 85**: ~105 KB (88% reduction) - **Default**
- **Quality 95**: ~190 KB (79% reduction)

### Quality Recommendations
- **Quality 75**: Maximum compression, good for storage/transmission
- **Quality 85**: Balanced compression and quality (default)
- **Quality 95**: Highest quality, minimal compression artifacts
