# Receipt OCR Parser - Vision model capability test

Built in deno for science.

## Features

- Automatic image chunking for long receipts (896x896 segments)
- Text deduplication between chunks (partially so)
- Multiple normalization methods (chunk, letterbox, crop, stretch)
- Comprehensive performance metrics tracking and storage
- Automatic text export to `.txt` files
- Performance analytics and session history

## Quick Start

**Prerequisites:** [Deno](https://deno.land/), [LM Studio](https://lmstudio.ai/) on port 1234, vision model loaded

```bash
# Process an image
deno run --allow-read --allow-write --allow-net --allow-sys --allow-env main.ts path/to/receipt.jpg [model_name]

# View performance metrics
deno run --allow-read view_metrics.ts [options]
```

## Performance Metrics

The system automatically tracks and stores comprehensive performance metrics in `../performance_metrics.json`:

### Tracked Metrics
- **Timing**: Image normalization, loading, API requests, total execution time
- **Token Usage**: Input/output tokens, text vs image token breakdown
- **Model Performance**: Tokens per second, time to first token, generation time
- **Processing Details**: Number of chunks, individual chunk performance
- **Output Quality**: Lines, characters, success rate
- **Configuration**: Model used, processing settings, file information

### Viewing Metrics

```bash
# Show all sessions summary
deno run --allow-read view_metrics.ts

📊 Recent Processing Sessions (10)
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Timestamp            File                 Model                          Status   Time     Tok/s    Lines    Chars    Tokens
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
2025-11-02T15:03:07  temp_receipt.jpg     gliese-ocr-7b-post2.0-final    ✅        10.85s   60.1     23       698      284
2025-11-02T15:03:29  temp_receipt.jpg     google/gemma-3-27b             ✅        15.85s   34.3     23       690      277
2025-11-02T15:30:05  temp_receipt.jpg     nanonets-ocr2-3b               ✅        13.61s   60.7     23       690      274
2025-11-02T15:31:19  WW-02-11-25.jpg      nanonets-ocr2-3b               ✅        31.77s   59.9     93       1,867    792
2025-11-02T15:34:47  WW-02-11-25.jpg      gemma-3-12b-it                 ✅        10.97s   61.2     24       554      222
2025-11-02T15:39:47  WW-02-11-25.jpg      qari                           ✅        28.26s   92.1     18       2,347    1075
2025-11-02T15:41:58  WW-02-11-25.jpg      internvl3-14b-instruct         ✅        18.32s   60.0     51       1,098    482
2025-11-02T16:29:15  WW-02-11-25.jpg      olmocr-2-7b-1025               ✅        29.72s   60.2     64       1,556    670
2025-11-02T17:27:50  tyres.jpg            olmocr-2-7b-1025               ✅        21.81s   68.2     24       1,109    368
2025-11-02T18:16:26  tyres.jpg            allenai_olmocr-2-7b-1025       ✅        16.43s   68.7     24       1,114    368

💡 Usage Tips:
   --latest     Show detailed view of latest session
   --stats      Show summary statistics across all sessions
   --sessions N Show last N sessions in detail

   Example: deno run --allow-read view_metrics.ts --latest
```

## How It Works

1. **Image Normalization**: Splits long receipts into overlapping 896x896 chunks
2. **OCR Processing**: Sends each chunk to LM Studio vision model
3. **Text Extraction**: Extracts and deduplicates text from all chunks
4. **Performance Tracking**: Records comprehensive metrics for each session
5. **Export**: Saves consolidated text to `.txt` file and metrics to JSON

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
