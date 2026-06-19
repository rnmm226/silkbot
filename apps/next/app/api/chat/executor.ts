// app/api/chat/executor.ts
import type { Plan, ToolResult } from "./types";
import { toolMap } from "./tools";

export async function executePlan(plan: Plan): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  console.log(`[Executor] Exécution de ${plan.tools.length} outils`);

  for (const toolName of plan.tools) {
    try {
      const toolFn = toolMap[toolName];
      if (!toolFn) {
        console.warn(`[Executor] ⚠️ Outil "${toolName}" non trouvé`);
        results.push({
          tool: toolName,
          result: null,
          error: `Tool "${toolName}" not found`,
        });
        continue;
      }

      console.log(`[Executor] 🔧 Exécution de ${toolName}`);
      const result = await toolFn(plan.search_query);
      const chunksCount = result.chunks?.length || 0;
      console.log(`[Executor] ✅ ${toolName}: ${chunksCount} chunks`);
      
      results.push({
        tool: toolName,
        result,
      });
    } catch (error) {
      console.error(`[Executor] ❌ Erreur pour ${toolName}:`, error);
      results.push({
        tool: toolName,
        result: null,
        error: String(error),
      });
    }
  }

  return results;
}