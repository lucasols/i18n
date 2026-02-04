import fs from 'node:fs';
import path from 'node:path';
import type {
  AIProvider,
  TokenUsage,
  TranslationContext,
  TranslationResult,
} from './ai-translator';

const MAX_LOG_FILES = 10;

export type AiLogEntry = {
  timestamp: string;
  provider: AIProvider;
  model: string | undefined;
  prompt: string;
  contexts: TranslationContext[];
  results: Array<{
    sourceKey: string;
    result: TranslationResult | undefined;
  }>;
  usage: TokenUsage | undefined;
  durationMs: number;
  error: string | undefined;
};

function getAiLogsFolder(): string | null {
  return process.env['AI_LOGS_FOLDER'] || null;
}

function cleanupOldLogs(folder: string): void {
  const files = fs
    .readdirSync(folder)
    .filter((f) => f.startsWith('ai-log-') && f.endsWith('.json'))
    .sort();

  while (files.length >= MAX_LOG_FILES) {
    const oldest = files.shift();
    if (oldest) {
      fs.unlinkSync(path.join(folder, oldest));
    }
  }
}

export function logAiGeneration(data: AiLogEntry): void {
  const folder = getAiLogsFolder();
  if (!folder) return;

  fs.mkdirSync(folder, { recursive: true });
  cleanupOldLogs(folder);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `ai-log-${timestamp}.json`;
  const filepath = path.join(folder, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}
