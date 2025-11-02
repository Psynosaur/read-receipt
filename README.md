# Receipt OCR Parser

TypeScript OCR system for extracting text from receipt images using LM Studio vision models. Automatically chunks long receipts, deduplicates overlapping text, and stores comprehensive performance metrics.

## Features

- Automatic image chunking for long receipts (896x896 segments)
- Text deduplication between chunks
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

# Show latest session details
deno run --allow-read view_metrics.ts --latest

# Show summary statistics
deno run --allow-read view_metrics.ts --stats

# Show last 5 sessions
deno run --allow-read view_metrics.ts --sessions 5
```

### Sample Performance Output
```
Performance Metrics:
- Image Normalization: 192.70ms
- Image Load & Encode: 52.70ms
- API Request & Parse: 32061.32ms
- Total Execution Time: 33961.94ms

Individual Chunk Performance Summary: 4 chunks processed. 
Total tokens: 1416 input (380 text + 1036 image) + 922 output = 2338 total

LM Studio Performance Stats (averaged across 4 chunks): 
Model: google/gemma-3-27b, 34.29 tok/sec, 1226.50ms TTFT, 8015.33ms generation time
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
