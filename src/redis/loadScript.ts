import { readFileSync } from 'fs';
import path from 'path';

export function loadLuaScript(filename: string): string {
  try {
    const fullPath = path.join(__dirname, 'scripts', filename);
    return readFileSync(fullPath, 'utf8');
  } catch (error: any) {
    throw new Error(`Failed to load Lua script '${filename}': ${error instanceof Error ? error.message : String(error)}`);
  }
}