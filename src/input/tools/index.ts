// ── Tool registry ─────────────────────────────────────────────
// To add a tool: write a `Tool` in this folder, add its name to `Tool` in core/types.ts, and
// register it here.
import type { Tool as ToolName } from '../../core/types';
import { eraseTool } from './eraser';
import { rulerTool } from './ruler';
import { selectTool } from './select';
import { rectTool, tokenTool, wallTool } from './shapes';
import { textTool } from './text';
import type { Tool } from './types';

export const tools: Record<ToolName, Tool> = {
  select: selectTool,
  rect: rectTool,
  wall: wallTool,
  token: tokenTool,
  text: textTool,
  erase: eraseTool,
  ruler: rulerTool,
};
