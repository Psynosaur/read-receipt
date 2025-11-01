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
B/RIB TOASTER BROWN 700G
85  17.99*
BANANAS LS
1.984KG NET @ 16.99/kg  33.71*
115
BUTTERNUT LS
1.534KG NET @ 7.99/kg  12.26*
2011
2011
CHEDDAR
0.478KG NET @ 109.99/KG 52.58
32726
CHEESE & HAM NOODLE SALAD
0.322KG NET @ 140.00/KG 45.08
5115
COLESLAW SALAD
0.376KG NET @ 70.00/KG 26.32
47830
CURRIED PASTA SALAD
0.206KG NET @ 79.90/KG 16.46
F/C MILK ECD FRESH F/C 2L
2 @ 29.95 59.90*
F/C YOG F/C S/BERRY 1KG 39.99
F/L W/BUTTON MUSHROOMS 200G
2 @ 22.99 45.98*
PROMOTION DISCOUNT -6.98
FL BROCCOLI FLORETS 500G 29.99*
FLYERS PUFFED CORN 100G 12.99
KIWI FRUIT GREEN 14.99
MAGGI HDLS MP CHICKEN 5S 68G 36.99
460
ONIONS LS 12.69*
0.668kg NET @ 18.99/kg
8384
PASTA PESTO SALAD 30.80
0.220kg NET @ 140.00/kg
290
PEPPERS GREEN LS 14.94*
0.498kg NET @ 29.99/kg
4099
POTATO SALAD 21.28
0.266kg NET @ 80.00/kg
ROLLS SAVOURY 41.94
6 @ 6.99
PROMOTION DISCOUNT -5.94
SIRCO COCOA CREAM 500G 39.99
SPOOKIES PUFFS CHEESE 100G 12.99
17562
SWEET POT ORANGE LS 24.99*
1.250kg NET @ 19.99/kg
TOTAL 685.91
EFT 685.91
CHANGE 0.00
VAT SUMMARY
Description NET VAT TOTAL
*Non Vat 299.46 0.00 299.46
VAT 336.04 50.41 386.45
VAT TOTALS 635.50 50.41 685.91
==================================================
📊 Final output: 69 lines, 1333 characters
💾 Final text saved to: .\data\auto_cropped_extracted_text.txt
🔧 Calculating average performance stats from all chunks...

📊 Performance Metrics:
- Image Normalization: 233.23ms
- Image Load & Encode: 8.94ms
- API Request & Parse: 29319.12ms
- Total Execution Time: 29881.75ms

⚡ Individual Chunk Performance:
- Chunk 1: 34.79 tok/sec, 692ms TTFT
- Chunk 2: 34.87 tok/sec, 470ms TTFT
- Chunk 3: 34.84 tok/sec, 462ms TTFT
- Chunk 4: 35.20 tok/sec, 465ms TTFT

🎮 LM Studio Performance Stats (Averaged across 4 chunks):
- Average Tokens/Second: 34.93 tok/sec
- Average Time to First Token: 522.25ms
- Average Generation Time: 6730.25ms
- Stop Reason: eosFound
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