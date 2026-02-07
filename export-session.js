#!/usr/bin/env node

/**
 * export-session.js — Export Claude Code sessions as Markdown transcripts.
 *
 * Usage:
 *   node export-session.js                   # List available sessions
 *   node export-session.js <session-id>      # Export a specific session
 *   node export-session.js --latest          # Export the most recent session
 *   node export-session.js --all             # List all sessions across all projects
 *
 * Options:
 *   --no-tools       Omit tool use / tool result details (compact mode)
 *   --no-thinking    Omit assistant thinking blocks
 *   --out <file>     Write output to a file instead of stdout
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Configuration ───────────────────────────────────────────────────────────

const CLAUDE_DIR = path.join(os.homedir(), ".claude", "projects");

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  showTools: !args.includes("--no-tools"),
  showThinking: !args.includes("--no-thinking"),
  latest: args.includes("--latest"),
  listAll: args.includes("--all"),
  out: null,
  sessionId: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out" && args[i + 1]) {
    flags.out = args[i + 1];
    i++;
  } else if (!args[i].startsWith("--")) {
    flags.sessionId = args[i];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function discoverSessions() {
  const sessions = [];
  if (!fs.existsSync(CLAUDE_DIR)) return sessions;

  for (const projectDir of fs.readdirSync(CLAUDE_DIR)) {
    const projectPath = path.join(CLAUDE_DIR, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    for (const file of fs.readdirSync(projectPath)) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(projectPath, file);
      if (fs.statSync(filePath).isDirectory()) continue;

      const sessionId = file.replace(".jsonl", "");
      const lines = fs
        .readFileSync(filePath, "utf-8")
        .split("\n")
        .filter(Boolean);

      let firstTimestamp = null;
      let lastTimestamp = null;
      let userMsgCount = 0;
      let assistantMsgCount = 0;
      let projectName = projectDir.replace(/^-/, "").replace(/-/g, "/");

      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.timestamp) {
            if (!firstTimestamp) firstTimestamp = record.timestamp;
            lastTimestamp = record.timestamp;
          }
          if (record.type === "user" && record.message?.role === "user") {
            // Don't count tool results as user messages
            const content = record.message.content;
            if (typeof content === "string") userMsgCount++;
            else if (
              Array.isArray(content) &&
              content.some((b) => b.type === "text")
            )
              userMsgCount++;
          }
          if (record.type === "assistant") assistantMsgCount++;
        } catch {}
      }

      sessions.push({
        sessionId,
        projectDir,
        projectName,
        filePath,
        firstTimestamp,
        lastTimestamp,
        userMsgCount,
        assistantMsgCount,
        lineCount: lines.length,
        fileSize: fs.statSync(filePath).size,
      });
    }
  }

  sessions.sort(
    (a, b) => new Date(b.firstTimestamp) - new Date(a.firstTimestamp)
  );
  return sessions;
}

function formatTimestamp(ts) {
  if (!ts) return "unknown";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDuration(startTs, endTs) {
  if (!startTs || !endTs) return "unknown";
  const ms = new Date(endTs) - new Date(startTs);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function extractToolUseBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block.type === "tool_use");
}

function extractThinkingBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block.type === "thinking");
}

function extractToolResultBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block.type === "tool_result");
}

function truncate(text, maxLen = 500) {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... (truncated)";
}

function formatToolInput(input) {
  if (!input) return "";
  const lines = [];
  for (const [key, value] of Object.entries(input)) {
    const strVal = typeof value === "string" ? value : JSON.stringify(value);
    if (strVal.length > 200) {
      lines.push(`  ${key}: ${strVal.slice(0, 200)}...`);
    } else {
      lines.push(`  ${key}: ${strVal}`);
    }
  }
  return lines.join("\n");
}

function extractToolResultText(block) {
  if (!block.content) return "(no output)";
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return JSON.stringify(block.content);
}

// ─── Markdown Generation ─────────────────────────────────────────────────────

function sessionToMarkdown(filePath, session) {
  const lines = fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .filter(Boolean);
  const records = [];

  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {}
  }

  const md = [];

  // Header
  md.push(`# Claude Code Session Transcript`);
  md.push("");
  if (session) {
    md.push(`| | |`);
    md.push(`|---|---|`);
    md.push(`| **Project** | \`${session.projectName}\` |`);
    md.push(`| **Session ID** | \`${session.sessionId}\` |`);
    md.push(
      `| **Started** | ${formatTimestamp(session.firstTimestamp)} |`
    );
    md.push(
      `| **Duration** | ${formatDuration(session.firstTimestamp, session.lastTimestamp)} |`
    );
    md.push(
      `| **User Messages** | ${session.userMsgCount} |`
    );
    md.push(
      `| **Assistant Turns** | ${session.assistantMsgCount} |`
    );
    md.push("");
  }
  md.push("---");
  md.push("");

  // Deduplicate: assistant messages come in streaming chunks with the same requestId.
  // We want to merge all chunks that share the same requestId into a single turn.
  const mergedRecords = mergeAssistantChunks(records);

  for (const record of mergedRecords) {
    if (record.type === "user" && record.message?.role === "user") {
      const content = record.message.content;

      // Check if this is a tool result
      const toolResults = extractToolResultBlocks(
        Array.isArray(content) ? content : []
      );
      if (toolResults.length > 0 && flags.showTools) {
        for (const tr of toolResults) {
          const resultText = extractToolResultText(tr);
          md.push(`<details>`);
          md.push(`<summary>Tool Result</summary>`);
          md.push("");
          md.push("```");
          md.push(truncate(resultText, 2000));
          md.push("```");
          md.push("</details>");
          md.push("");
        }
        // Also show any text content alongside tool results
        const textContent = extractTextContent(content);
        if (textContent && textContent.trim()) {
          md.push(`### User`);
          md.push("");
          md.push(textContent.trim());
          md.push("");
        }
        continue;
      }

      // Regular user message
      const textContent = extractTextContent(content);
      if (textContent && textContent.trim()) {
        // Skip interruption markers as standalone messages
        if (textContent.trim() === "[Request interrupted by user]") {
          md.push(`> *[Request interrupted by user]*`);
          md.push("");
          continue;
        }
        md.push(`### User`);
        md.push("");
        md.push(textContent.trim());
        md.push("");
      }
    } else if (record.type === "assistant" && record.message?.content) {
      const content = record.message.content;

      // Thinking blocks
      if (flags.showThinking) {
        const thinkingBlocks = extractThinkingBlocks(
          Array.isArray(content) ? content : []
        );
        for (const tb of thinkingBlocks) {
          if (tb.thinking && tb.thinking.trim()) {
            md.push(`<details>`);
            md.push(`<summary>Assistant Thinking</summary>`);
            md.push("");
            md.push(tb.thinking.trim());
            md.push("");
            md.push(`</details>`);
            md.push("");
          }
        }
      }

      // Text content
      const textContent = extractTextContent(content);
      if (textContent && textContent.trim()) {
        md.push(`### Assistant`);
        md.push("");
        md.push(textContent.trim());
        md.push("");
      }

      // Tool use blocks
      if (flags.showTools) {
        const toolUses = extractToolUseBlocks(
          Array.isArray(content) ? content : []
        );
        for (const tu of toolUses) {
          md.push(`<details>`);
          md.push(
            `<summary>Tool: <code>${tu.name}</code></summary>`
          );
          md.push("");
          if (tu.input) {
            md.push("```");
            md.push(formatToolInput(tu.input));
            md.push("```");
          }
          md.push("</details>");
          md.push("");
        }
      }
    } else if (record.type === "system" && record.subtype === "api_error") {
      // Skip transient API errors — not useful in transcript
    }
  }

  md.push("---");
  md.push(
    `*Exported on ${formatTimestamp(new Date().toISOString())} using export-session.js*`
  );
  md.push("");

  return md.join("\n");
}

/**
 * Merge streaming assistant chunks that share the same requestId into
 * a single record with all content blocks combined.
 */
function mergeAssistantChunks(records) {
  const merged = [];
  const seenRequestIds = new Set();

  for (const record of records) {
    if (record.type === "assistant" && record.requestId) {
      if (seenRequestIds.has(record.requestId)) {
        // Find the existing merged record and add new content blocks
        const existing = merged.find(
          (r) =>
            r.type === "assistant" && r.requestId === record.requestId
        );
        if (existing && record.message?.content) {
          const existingContent = Array.isArray(existing.message.content)
            ? existing.message.content
            : [];
          const newContent = Array.isArray(record.message.content)
            ? record.message.content
            : [];

          // Merge: add blocks that aren't duplicates
          for (const block of newContent) {
            const isDuplicate = existingContent.some(
              (eb) =>
                eb.type === block.type &&
                JSON.stringify(eb) === JSON.stringify(block)
            );
            if (!isDuplicate) {
              existingContent.push(block);
            }
          }
          existing.message.content = existingContent;
          // Update timestamp to latest
          existing.timestamp = record.timestamp;
        }
      } else {
        seenRequestIds.add(record.requestId);
        // Deep-clone to avoid mutating original
        merged.push(JSON.parse(JSON.stringify(record)));
      }
    } else {
      merged.push(record);
    }
  }

  return merged;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const sessions = discoverSessions();

  // List mode
  if (!flags.sessionId && !flags.latest) {
    if (sessions.length === 0) {
      console.log("No Claude Code sessions found in ~/.claude/projects/");
      console.log(
        "Sessions are stored after you use Claude Code in a project directory."
      );
      process.exit(0);
    }

    console.log("Available Claude Code Sessions:\n");
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      console.log(
        `  ${i + 1}. [${formatTimestamp(s.firstTimestamp)}] ${s.projectName}`
      );
      console.log(
        `     ID: ${s.sessionId}`
      );
      console.log(
        `     Duration: ${formatDuration(s.firstTimestamp, s.lastTimestamp)} | ${s.userMsgCount} user msgs, ${s.assistantMsgCount} assistant turns | ${formatBytes(s.fileSize)}`
      );
      console.log("");
    }
    console.log("To export a session, run:");
    console.log("  node export-session.js <session-id>");
    console.log("  node export-session.js --latest");
    console.log(
      "  node export-session.js --latest --out transcript.md"
    );
    console.log(
      "\nOptions: --no-tools --no-thinking --out <file>"
    );
    process.exit(0);
  }

  // Find the target session
  let target;
  if (flags.latest) {
    target = sessions[0];
  } else {
    target = sessions.find(
      (s) =>
        s.sessionId === flags.sessionId ||
        s.sessionId.startsWith(flags.sessionId)
    );
  }

  if (!target) {
    console.error(
      `Session not found: ${flags.sessionId || "(none)"}`
    );
    console.error("Run without arguments to see available sessions.");
    process.exit(1);
  }

  const markdown = sessionToMarkdown(target.filePath, target);

  if (flags.out) {
    const outPath = path.resolve(flags.out);
    fs.writeFileSync(outPath, markdown, "utf-8");
    console.error(`Transcript written to ${outPath}`);
    console.error(
      `Session: ${target.sessionId}`
    );
    console.error(
      `Project: ${target.projectName}`
    );
    console.error(
      `Started: ${formatTimestamp(target.firstTimestamp)}`
    );
  } else {
    process.stdout.write(markdown);
  }
}

main();
