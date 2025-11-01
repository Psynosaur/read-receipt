# Receipt OCR Parser with Image Normalization

TypeScript-based OCR system for extracting text from receipt images using LM Studio vision models. The system handles long receipts by chunking them into optimal segments and provides some text deduplication features.

## Features

- **Smart Image Normalization**: Automatically detects and handles long receipts by chunking them into 896x896 segments
- **Text Deduplication**: Intelligently removes overlapping text between chunks to create seamless output
- **Multiple Processing Methods**: Supports letterbox, crop, stretch, and chunk normalization methods
- **Performance Metrics**: Detailed timing information for optimization
- **Automatic Text Export**: Saves final consolidated text to `.txt` files

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) runtime
- [LM Studio](https://lmstudio.ai/) running locally on port 1234
- A vision-capable model loaded in LM Studio (e.g., LLaVA, Google Gemini)

### Basic Usage

```bash
# Process a single receipt image
deno run --allow-read --allow-write --allow-net main.ts path/to/receipt.jpg [model_name]

# Example with specific model
deno run --allow-read --allow-write --allow-net main.ts ./auto_cropped.jpg google/gemma-3-27b
```

## File Structure

```
imageParser/
├── main.ts                    # Main OCR processing script
├── image_normalizer.ts        # Image normalization utilities
├── auto_cropped.jpg           # Example receipt image
├── auto_cropped_extracted_text.txt # Final text output
└── README.md                       # This file
```

## How It Works

### 1. Image Normalization (`image_normalizer.ts`)

The system uses sophisticated image processing to handle various receipt formats:

#### **Chunking Method** (Default for long receipts)
- Detects receipts with aspect ratio > 1.5
- Splits into 896x896 chunks with configurable overlap (default: 100px)
- Maintains aspect ratio and quality

#### **Other Methods**
- **Letterbox**: Preserves aspect ratio, adds padding
- **Crop**: Preserves aspect ratio, crops excess
- **Stretch**: Stretches to exact dimensions

```typescript
// Example normalization options
const options = {
    method: 'chunk',
    targetWidth: 896,
    targetHeight: 896,
    chunkOverlap: 100,
    jpegQuality: 85,
    applyPreprocessing: false
};
```

### 2. OCR Processing (`main.ts`)

The main script orchestrates the entire pipeline:

1. **Image Normalization**: Converts input to optimal format
2. **Chunk Processing**: Sends each chunk to LM Studio vision model
3. **Text Extraction**: Extracts text from each chunk
4. **Deduplication**: Removes overlapping content between chunks
5. **Consolidation**: Creates final seamless output

### 3. Smart Text Deduplication

The system includes advanced algorithms to handle overlapping text:

```typescript
// Deduplication features:
- Fuzzy matching for OCR variations
- Line-by-line comparison
- Intelligent overlap detection
- Seamless content merging
```

## Example Output

### Input Image
![Receipt Example](./auto_cropped.jpg)

### Processing Results

```
🎯 Normalizing image to 896x896...
📄 Long receipt detected (aspect ratio: 3.28), creating chunks...
📋 Processing 4 image(s)...

🔗 Processing and deduplicating results from all chunks...
🔄 Deduplicating overlapping text between chunks...
  ✅ Added 19 lines from chunk 1
  🔍 Processing chunk 2 with 25 lines...
    📌 Found overlap at position 2, adding 23 unique lines
  🔍 Processing chunk 3 with 23 lines...
    📌 Found overlap at position 3, adding 20 unique lines
  🔍 Processing chunk 4 with 8 lines...
    📌 Found overlap at position 1, adding 7 unique lines
✅ Deduplication complete: 69 total lines
```

### Final Consolidated Text Output

```
WILLOWBRIDGE
North Shopping Centre, Tyger Valley
Tel No: 021 914 8011
WCP/037338
VAT NO. 4270124169
TAX INVOICE

A/G TOMATO PASTE 500G
2 @ 7.49  14.98
AVOS EACH
4 @ 12.99  51.96*
PROMOTION DISCOUNT -12.96
...
TOTAL 685.91
EFT 685.91
CHANGE 0.00
VAT SUMMARY
Description NET VAT TOTAL
*Non Vat 299.46 0.00 299.46
VAT 336.04 50.41 386.45
VAT TOTALS 635.50 50.41 685.91
```

*Complete output saved to: `./auto_cropped_extracted_text.txt`*

## Configuration

### LM Studio Setup

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a vision-capable model (recommended: LLaVA, Google Gemini models)
3. Start the local server on port 1234
4. Ensure the model supports image input

### Environment Variables

```typescript
// Configuration in main.ts
const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const DEFAULT_MODEL = "llava";
```

### Image Processing Options

```typescript
// Available in normalizeImage() function
interface ImageNormalizationOptions {
  targetWidth?: number;        // Default: 896
  targetHeight?: number;       // Default: 896
  method?: 'letterbox' | 'crop' | 'stretch' | 'chunk';
  chunkOverlap?: number;       // Default: 50 (100 recommended for receipts)
  jpegQuality?: number;        // Default: 85
  applyPreprocessing?: boolean; // Default: false
  sharpeningStrength?: number; // Default: 1.0
  contrastFactor?: number;     // Default: 1.5
  thresholdValue?: number;     // Default: 128
}
```

## Performance Metrics

The system provides detailed performance tracking:

```
📊 Performance Metrics:
- Image Normalization: 193.00ms
- Image Load & Encode: 10.30ms
- API Request & Parse: 29935.28ms
- Total Execution Time: 30150.15ms
```

## Use Cases

- **Retail Receipt Processing**: Extract itemized purchases and totals
- **Expense Management**: Automated expense report generation
- **Inventory Tracking**: Parse product codes and quantities
- **Financial Analysis**: Extract tax and payment information
- **Document Digitization**: Convert physical receipts to searchable text

## Technical Details

### Chunk Overlap Strategy

The system uses overlapping chunks to ensure no text is lost at boundaries:
- Default overlap: 100px (configurable)
- Smart detection of duplicate content
- Fuzzy matching for OCR variations
- Seamless reconstruction of original document flow

### Text Processing Pipeline

1. **Raw OCR**: Extract text from each chunk
2. **Filtering**: Remove empty or invalid chunks
3. **Normalization**: Standardize line formatting
4. **Deduplication**: Remove overlapping content
5. **Consolidation**: Merge into final output
6. **Export**: Save to text file

## Development

### Adding New Models

To add support for new vision models:

1. Update the `DEFAULT_MODEL` constant in `main.ts`
2. Adjust the prompt if needed for model-specific requirements
3. Test with various receipt types

### Customizing OCR Prompts

The OCR prompt can be customized in `main.ts`:

```typescript
const prompt = `
You are a receipt parser.
Extract all textual transactional information writing output in plain text in order of appearance
IMPORTANT: If this image chunk contains mostly empty space, respond with "EMPTY_CHUNK" only.
`;
```

## Troubleshooting

### Common Issues

1. **LM Studio Connection Failed**
   - Ensure LM Studio is running on port 1234
   - Check that a vision model is loaded

2. **Poor OCR Quality**
   - Try enabling preprocessing: `applyPreprocessing: true`
   - Adjust contrast and sharpening parameters
   - Increase chunk overlap for better boundary handling

3. **Missing Text**
   - Increase `chunkOverlap` parameter
   - Check if chunks are being skipped (look for "too small" messages)
   - Verify input image quality

## LM Studio output for chunk4 of test data
![alt text](<Lm studio out.png>)