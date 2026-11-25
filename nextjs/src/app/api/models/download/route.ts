import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  MODEL_CATALOG,
  getModelPath,
  isModelDownloaded,
  saveConfig,
} from "@/lib/model-manager";

// Process exit handler: clean up .tmp files on crash
if (typeof process !== "undefined") {
  const cleanupTmpFiles = () => {
    try {
      const modelsDir = path.join(process.cwd(), "data", "models");
      if (!fs.existsSync(modelsDir)) return;
      const files = fs.readdirSync(modelsDir);
      for (const file of files) {
        if (file.endsWith(".tmp")) {
          try {
            fs.unlinkSync(path.join(modelsDir, file));
            console.log(`[CLEANUP] Removed temp file: ${file}`);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch {
      // Cleanup must never crash
    }
  };
  process.on("exit", cleanupTmpFiles);
  process.on("SIGINT", () => { cleanupTmpFiles(); process.exit(0); });
  process.on("SIGTERM", () => { cleanupTmpFiles(); process.exit(0); });
  process.on("uncaughtException", (err) => {
    console.error("[FATAL]", err);
    cleanupTmpFiles();
    process.exit(1);
  });
}
// ── Security constants ─────────────────────────────────────────────────────────

const ALLOWED_DOWNLOAD_HOSTS = [
  "huggingface.co",
  "cdn-lfs.huggingface.co",
  "us.aws.cdn.hf.co",
];

const MAX_DOWNLOAD_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const GGUF_MAGIC = Buffer.from("GGUF"); // GGUF file magic bytes

// SHA256 checksums for catalog models (verified at download time)
const MODEL_CHECKSUMS: Record<string, string> = {
  // SHA256 hashes computed from actual model files
  // Run: python scripts/compute_checksums.py --models-dir <path>
  // nomic-embed checksum omitted - model file not available locally
  "gemma-4-e2b": "fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634",
  "qwen-3.8b-9b": "df13d66021cef676f82be74053220fd75af6bf2a6a7fb77f5222ab9e50744a7a",
  "qwythos-9b": "5c09e7f207d2fd9069c802ff77632fa7cdaffe7fb5ba40ff9f060aaeaa09acd5",
};

// ── Validation helpers ─────────────────────────────────────────────────────────

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      ALLOWED_DOWNLOAD_HOSTS.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

function isSafeFilename(filename: string): boolean {
  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }
  // Only allow .gguf extension
  if (!filename.toLowerCase().endsWith(".gguf")) {
    return false;
  }
  // Reasonable length
  if (filename.length > 255 || filename.length < 5) {
    return false;
  }
  return true;
}

function validateGgufFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.equals(GGUF_MAGIC);
  } catch {
    return false;
  }
}

function computeSha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

// ── Route handler ──────────────────────────────────────────────────────────────

function auditLog(modelId: string, ip: string, success: boolean, detail: string) {
  const entry = { ts: new Date().toISOString(), modelId, ip, success, detail };
  console.log(`[DOWNLOAD AUDIT] ${JSON.stringify(entry)}`);
  try {
    const auditPath = path.join(process.cwd(), "data", "download-audit.jsonl");
    const dir = path.dirname(auditPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(auditPath, JSON.stringify(entry) + "\\n");
  } catch {
    // Audit logging must never crash the download
  }
}

// Download history: track successful downloads to prevent redundant re-downloads
function recordDownloadHistory(modelId: string, filename: string, sha256: string, bytes: number) {
  try {
    const historyPath = path.join(process.cwd(), "data", "download-history.jsonl");
    const dir = path.dirname(historyPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      modelId,
      filename,
      sha256,
      bytes,
      action: "downloaded",
    };
    fs.appendFileSync(historyPath, JSON.stringify(entry) + "\\n");
  } catch {
    // History tracking must never crash the download
  }
}

function getDownloadHistory(): Record<string, { sha256: string; ts: string }> {
  const history: Record<string, { sha256: string; ts: string }> = {};
  try {
    const historyPath = path.join(process.cwd(), "data", "download-history.jsonl");
    if (!fs.existsSync(historyPath)) return history;
    const lines = fs.readFileSync(historyPath, "utf-8").split("\\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.modelId && entry.sha256) {
          history[entry.modelId] = { sha256: entry.sha256, ts: entry.ts };
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Return empty history on error
  }
  return history;
}

// Process exit handler: clean up .tmp files on crash
function cleanupTmpFiles() {
  try {
    const modelsDir = path.join(process.cwd(), "data", "models");
    if (!fs.existsSync(modelsDir)) return;
    const files = fs.readdirSync(modelsDir);
    for (const file of files) {
      if (file.endsWith(".tmp")) {
        try {
          fs.unlinkSync(path.join(modelsDir, file));
          console.log(`[CLEANUP] Removed temp file: ${file}`);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch {
    // Cleanup must never crash
  }
}

// Register cleanup on process exit
if (typeof process !== "undefined") {
  process.on("exit", cleanupTmpFiles);
  process.on("SIGINT", () => { cleanupTmpFiles(); process.exit(0); });
  process.on("SIGTERM", () => { cleanupTmpFiles(); process.exit(0); });
  process.on("uncaughtException", (err) => {
    console.error("[FATAL]", err);
    cleanupTmpFiles();
    process.exit(1);
  });
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const { checkRateLimit, getRateLimitHeaders } = await import("@/lib/rate-limiter");
  const rl = checkRateLimit(ip, "download");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: getRateLimitHeaders(rl.remaining, rl.resetAt),
      },
    );
  }

  try {
    const body = await req.json();
    const { modelId } = body;

    // 1. Validate model ID against catalog (no arbitrary downloads)
    const model = MODEL_CATALOG.find((m) => m.id === modelId);
    if (!model) {
      return NextResponse.json(
        { error: "Unknown model. Only catalog models can be downloaded." },
        { status: 404 },
      );
    }

    // 2. Validate URL is from trusted host
    if (!isAllowedUrl(model.url)) {
      return NextResponse.json(
        { error: "Download URL not from a trusted source." },
        { status: 403 },
      );
    }

    // 3. Validate filename is safe
    if (!isSafeFilename(model.filename)) {
      return NextResponse.json(
        { error: "Invalid model filename." },
        { status: 400 },
      );
    }

    const destPath = getModelPath(model.filename);

    if (isModelDownloaded(model.filename)) {
      // Verify existing file is valid GGUF
      if (!validateGgufFile(destPath)) {
        // Corrupt file - delete and re-download
        fs.unlinkSync(destPath);
      } else {
        // Check download history for checksum match (prevent redundant re-downloads)
        const history = getDownloadHistory();
        const histEntry = history[model.id];
        if (histEntry) {
          const currentChecksum = computeSha256(destPath);
          if (currentChecksum === histEntry.sha256) {
            auditLog(model.id, ip, true, "Already downloaded (checksum match, skipped)");
            return NextResponse.json({
              status: "already_downloaded",
              path: destPath,
              progress: 100,
              skipped: true,
            });
          }
        }
        return NextResponse.json({
          status: "already_downloaded",
          path: destPath,
          progress: 100,
        });
      }
    }

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Atomic write: download to .tmp, rename only after all validations pass
    const tmpPath = destPath + ".tmp";

    // 4. Fetch from trusted URL only
    // SECURITY: Reject redirects entirely (URL already validated against whitelist)
    const res = await fetch(model.url, {
      signal: AbortSignal.timeout(600_000),
      headers: {
        "User-Agent": "Klarecht/1.0",
      },
      redirect: "error", // Reject any redirects — final URL must match validated URL
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Download failed: HTTP ${res.status}` },
        { status: 502 },
      );
    }

    // 5. Validate Content-Type
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html") || contentType.includes("text/plain")) {
      return NextResponse.json(
        { error: "Download returned unexpected content type. Possible redirect or error page." },
        { status: 502 },
      );
    }

    const contentLength = res.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    // 5b. Disk space check (ensure enough free space for the download)
    try {
      const { statfsSync } = await import("node:fs");
      const stats = statfsSync(dir);
      const freeBytes = stats.bfree * stats.bsize;
      if (freeBytes < totalBytes + 100 * 1024 * 1024) { // 100MB buffer
        auditLog(model.id, ip, false, "Insufficient disk space");
        return NextResponse.json(
          { error: "Insufficient disk space for download." },
          { status: 507 },
        );
      }
    } catch {
      // statfs may not be available on all platforms — skip if unavailable
    }

    // 6. Size limit check
    if (totalBytes > MAX_DOWNLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(totalBytes / 1e9).toFixed(1)} GB). Maximum is ${MAX_DOWNLOAD_SIZE_BYTES / 1e9} GB.` },
        { status: 413 },
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No response body" }, { status: 502 });
    }

    // 7. Stream to file with progress
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const fileStream = fs.createWriteStream(tmpPath);
        let downloadedBytes = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloadedBytes += value.length;

            // Size limit during download
            if (downloadedBytes > MAX_DOWNLOAD_SIZE_BYTES) {
              fileStream.destroy();
              if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: "Download exceeded size limit" })}\n\n`,
                ),
              );
              controller.close();
              return;
            }

            const progress =
              totalBytes > 0
                ? Math.round((downloadedBytes / totalBytes) * 100)
                : 0;

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ progress, downloadedBytes, totalBytes })}\n\n`,
              ),
            );
          }
          fileStream.end();

          // 8. Validate downloaded file is a valid GGUF
          if (!validateGgufFile(tmpPath)) {
            fs.unlinkSync(tmpPath);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "Downloaded file is not a valid GGUF model. File deleted." })}\n\n`,
              ),
            );
            controller.close();
            return;
          }

          // 9. Optional: SHA256 checksum verification
          const expectedChecksum = MODEL_CHECKSUMS[model.id];
          if (expectedChecksum) {
            const actualChecksum = computeSha256(tmpPath);
            if (actualChecksum !== expectedChecksum) {
              fs.unlinkSync(tmpPath);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    error: `Checksum mismatch. Expected ${expectedChecksum}, got ${actualChecksum}. File deleted.`,
                  })}\n\n`,
                ),
              );
              controller.close();
              return;
            }
          }

          // 9. Atomic rename: move validated .tmp to final path
          fs.renameSync(tmpPath, destPath);

          // 9a. Record download history
          const fileSha256 = computeSha256(destPath);
          recordDownloadHistory(model.id, model.filename, fileSha256, downloadedBytes);

          // 9b. File permission lockdown (no execute bit)
          try {
            fs.chmodSync(destPath, 0o644);
          } catch {
            // chmod may not be available on all platforms
          }

          // 10. Update config
          const isEmbedding = model.id === "nomic-embed";
          if (isEmbedding) {
            saveConfig({ embedModelPath: destPath });
          } else {
            saveConfig({ chatModelPath: destPath });
          }

          auditLog(model.id, ip, true, `Downloaded ${downloadedBytes} bytes to ${destPath}`);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, path: destPath, progress: 100 })}\n\n`,
            ),
          );
          controller.close();
        } catch (e: any) {
          fileStream.destroy();
          // Clean up both tmp and final paths
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: `Download interrupted: ${e.message}` })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Download failed" },
      { status: 500 },
    );
  }
}