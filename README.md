# Receipt OCR Parser

TypeScript OCR system for extracting text from receipt images using LM Studio vision models. Automatically chunks long receipts and deduplicates overlapping text.

## Features

- Automatic image chunking for long receipts (896x896 segments)
- Text deduplication between chunks
- Multiple normalization methods (chunk, letterbox, crop, stretch)
- Performance metrics and timing
- Automatic text export to `.txt` files

## Quick Start

**Prerequisites:** [Deno](https://deno.land/), [LM Studio](https://lmstudio.ai/) on port 1234, vision model loaded

```bash
deno run --allow-read --allow-write --allow-net --allow-sys --allow-env main.ts path/to/receipt.jpg [model_name]
```

## How It Works

1. **Image Normalization**: Splits long receipts into overlapping 896x896 chunks
2. **OCR Processing**: Sends each chunk to LM Studio vision model
3. **Text Extraction**: Extracts and deduplicates text from all chunks
4. **Export**: Saves consolidated text to `.txt` file
## Configuration

### Key Settings

```typescript
// LM Studio
const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";

// Image Processing Options
{
  targetWidth: 896,
  targetHeight: 896,
  method: "chunk",
  chunkOverlap: 100,
  jpegQuality: 85
}
```

## Troubleshooting

- **Connection Failed**: Ensure LM Studio is running on port 1234 with a vision model
- **Poor OCR**: Try `applyPreprocessing: true` or increase `chunkOverlap`
- **Missing Text**: Increase chunk overlap, check image quality
