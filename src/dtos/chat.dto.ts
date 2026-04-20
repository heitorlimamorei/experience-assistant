import { z } from "zod";

export const chatMessageDTOSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1),
});

export const chatRequestDTOSchema = z.object({
  messages: z.array(chatMessageDTOSchema).min(1),
});

export type ChatMessageDTO = z.infer<typeof chatMessageDTOSchema>;
export type ChatRequestDTO = z.infer<typeof chatRequestDTOSchema>;

export interface ChatToolTraceDTO {
  toolName: string;
  input: unknown;
  output?: unknown;
}

export interface ChatResponseDTO {
  text: string;
  model: string;
  steps: number;
  tools: ChatToolTraceDTO[];
}
