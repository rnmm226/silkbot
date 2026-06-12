import { ToolSet, InferUITools } from 'ai';
import { z } from 'zod';

export const tools = {
  weather: {
    description: 'Get the current weather',
    inputSchema: z.object({
      location: z.string().describe('The city and state'),
    }),
    execute: async ({ location }: { location: string }) => {
      return `The weather in ${location} is sunny.`;
    },
  },
  calculator: {
    description: 'Perform basic arithmetic',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ operation, a, b }: { operation: 'add' | 'subtract' | 'multiply' | 'divide'; a: number; b: number }) => {
      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          return a / b;
      }
    },
  },
} satisfies ToolSet;

export type MyUITools = InferUITools<typeof tools>;