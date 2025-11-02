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

📊 Recent Processing Sessions (2)
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Session ID                Timestamp            File                 Status   Time     Tok/s    Lines    Chars
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
session_1762052714426_dt  2025/11/02, 05:05:4  auto_cropped.jpg     ✅        31.08s   34.3     69       1,326
session_1762053402128_sh  2025/11/02, 05:17:1  auto_cropped.jpg     ✅        29.76s   36.4     69       1,326

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
