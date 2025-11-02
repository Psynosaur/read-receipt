/**
 * Performance Metrics Analyzer
 * Tool for viewing and analyzing stored performance metrics
 * 
 * Usage: deno run --allow-read view_metrics.ts [options]
 * 
 * Options:
 *   --latest     Show only the latest session
 *   --stats      Show summary statistics
 *   --sessions N Show last N sessions
 */

import {
  getMetricsStatistics,
  loadMetrics,
  type PerformanceMetrics,
} from "./performance_metrics.ts";

interface ViewOptions {
  latest: boolean;
  stats: boolean;
  sessions: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ViewOptions {
  const args = Deno.args;
  const options: ViewOptions = {
    latest: false,
    stats: false,
    sessions: 0,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--latest":
        options.latest = true;
        break;
      case "--stats":
        options.stats = true;
        break;
      case "--sessions":
        if (i + 1 < args.length) {
          options.sessions = parseInt(args[i + 1], 10) || 0;
          i++; // Skip next argument
        }
        break;
    }
  }

  return options;
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Display detailed metrics for a session
 */
function displaySessionDetails(metrics: PerformanceMetrics): void {
  console.log(`\n📋 Session: ${metrics.sessionId}`);
  console.log(`📅 Timestamp: ${new Date(metrics.timestamp).toLocaleString()}`);
  console.log(`📁 File: ${metrics.inputFile.name}`);
  console.log(`🤖 Model: ${metrics.config.model}`);
  console.log(`⚙️  Method: ${metrics.config.normalizationMethod}`);
  console.log(`📊 Status: ${metrics.output.success ? "✅ Success" : "❌ Failed"}`);
  
  console.log(`\n⏱️  Timing Breakdown:`);
  console.log(`   Image Normalization: ${formatDuration(metrics.timings.imageNormalization)}`);
  console.log(`   Image Load & Encode: ${formatDuration(metrics.timings.imageLoadEncode)}`);
  console.log(`   API Request & Parse: ${formatDuration(metrics.timings.apiRequestParse)}`);
  console.log(`   Total Execution: ${formatDuration(metrics.timings.totalExecution)}`);
  
  console.log(`\n🧩 Chunk Processing:`);
  console.log(`   Chunks Processed: ${metrics.chunks.count}`);
  if (metrics.chunks.individual.length > 0) {
    const avgChunkTime = metrics.chunks.individual.reduce((sum, chunk) => sum + chunk.processingTime, 0) / metrics.chunks.individual.length;
    console.log(`   Avg Chunk Time: ${formatDuration(avgChunkTime)}`);
  }
  
  console.log(`\n🎯 Token Usage:`);
  console.log(`   Input Tokens: ${metrics.tokens.totalInput.toLocaleString()} (${metrics.tokens.textTokens.toLocaleString()} text + ${metrics.tokens.imageTokens.toLocaleString()} image)`);
  console.log(`   Output Tokens: ${metrics.tokens.totalOutput.toLocaleString()}`);
  console.log(`   Total Tokens: ${metrics.tokens.total.toLocaleString()}`);
  
  console.log(`\n🚀 Performance:`);
  console.log(`   Tokens/Second: ${metrics.lmStudioStats.tokensPerSecond.toFixed(2)}`);
  console.log(`   Time to First Token: ${formatDuration(metrics.lmStudioStats.timeToFirstToken)}`);
  console.log(`   Generation Time: ${formatDuration(metrics.lmStudioStats.generationTime)}`);
  
  console.log(`\n📄 Output:`);
  console.log(`   Lines: ${metrics.output.lines.toLocaleString()}`);
  console.log(`   Characters: ${metrics.output.characters.toLocaleString()}`);
  console.log(`   File: ${metrics.output.filePath}`);
}

/**
 * Display summary statistics
 */
async function displayStatistics(): Promise<void> {
  const stats = await getMetricsStatistics();
  
  console.log(`\n📈 Performance Statistics Summary`);
  console.log(`═════════════════════════════════`);
  console.log(`Total Sessions: ${stats.totalSessions}`);
  console.log(`Success Rate: ${stats.successRate.toFixed(1)}%`);
  console.log(`Avg Processing Time: ${formatDuration(stats.avgProcessingTime)}`);
  console.log(`Avg Tokens/Second: ${stats.avgTokensPerSecond.toFixed(2)}`);
  console.log(`Total Tokens Processed: ${stats.totalTokensProcessed.toLocaleString()}`);
}

/**
 * Display a compact list of sessions
 */
function displaySessionList(sessions: PerformanceMetrics[]): void {
  console.log(`\n📊 Recent Processing Sessions (${sessions.length})`);
  console.log(`${"─".repeat(100)}`);
  console.log(`${"Session ID".padEnd(25)} ${"Timestamp".padEnd(20)} ${"File".padEnd(20)} ${"Status".padEnd(8)} ${"Time".padEnd(8)} ${"Tok/s".padEnd(8)}`);
  console.log(`${"─".repeat(100)}`);
  
  sessions.forEach(session => {
    const timestamp = new Date(session.timestamp).toLocaleString().substring(0, 19);
    const fileName = session.inputFile.name.length > 18 ? session.inputFile.name.substring(0, 15) + "..." : session.inputFile.name;
    const status = session.output.success ? "✅" : "❌";
    const time = formatDuration(session.timings.totalExecution);
    const tokensPerSec = session.lmStudioStats.tokensPerSecond.toFixed(1);
    
    console.log(`${session.sessionId.substring(0, 24).padEnd(25)} ${timestamp.padEnd(20)} ${fileName.padEnd(20)} ${status.padEnd(8)} ${time.padEnd(8)} ${tokensPerSec.padEnd(8)}`);
  });
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    const allMetrics = await loadMetrics();
    
    if (allMetrics.length === 0) {
      console.log("📭 No performance metrics found. Run the image parser first to generate metrics.");
      return;
    }

    // Show statistics if requested
    if (options.stats) {
      await displayStatistics();
    }

    // Show specific sessions
    if (options.latest) {
      // Show only the latest session
      const latest = allMetrics[allMetrics.length - 1];
      displaySessionDetails(latest);
    } else if (options.sessions > 0) {
      // Show last N sessions
      const recentSessions = allMetrics.slice(-options.sessions);
      displaySessionList(recentSessions);
    } else {
      // Default: show session list
      displaySessionList(allMetrics);
    }

    // Show usage if no specific options
    if (!options.latest && !options.stats && options.sessions === 0) {
      console.log(`\n💡 Usage Tips:`);
      console.log(`   --latest     Show detailed view of latest session`);
      console.log(`   --stats      Show summary statistics across all sessions`);
      console.log(`   --sessions N Show last N sessions in detail`);
      console.log(`\n   Example: deno run --allow-read view_metrics.ts --latest`);
    }

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run the main function
if (import.meta.main) {
  await main();
}