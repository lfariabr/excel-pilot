import { readFileSync } from 'fs';
import path from 'path';

export function loadLuaScript(filename: string): string {
  const fullPath = path.join(__dirname, 'scripts', filename);
  return readFileSync(fullPath, 'utf8');
}