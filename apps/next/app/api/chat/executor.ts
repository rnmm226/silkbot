// app/api/chat/executor.ts
import type { Plan, ToolResult } from "./types";
import { toolMap } from "./tools";
import { SearchError } from "./errors";

export async function executePlan(plan: Plan): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  console.log(`[Executor] Exécution de ${plan.tools.length} outils`);

  for (const toolName of plan.tools) {
    try {
      const toolFn = toolMap[toolName];
      if (!toolFn) {
        console.warn(`[Executor] ⚠️ Outil "${toolName}" non trouvé`);
        // ✅ On lève une SearchError au lieu de juste logger une string,
        // pour que l'appelant (agent.ts) puisse distinguer ce cas
        // d'une vraie erreur réseau s'il le souhaite plus tard.
        const err = new SearchError(`Outil "${toolName}" non trouvé`, toolName);
        results.push({
          tool: toolName,
          result: null,
          error: err.message,
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
      // ✅ On wrappe systématiquement en SearchError, avec le nom de l'outil.
      // Ça permet à handleAgentError() de produire un message ciblé
      // ("Erreur de recherche avec l'outil X") plutôt qu'un message générique.
      const searchError = new SearchError(
        error instanceof Error ? error.message : String(error),
        toolName
      );
      console.error(`[Executor] ❌ Erreur pour ${toolName}:`, searchError.message);
      results.push({
        tool: toolName,
        result: null,
        error: searchError.message,
      });
    }
  }

  return results;
}