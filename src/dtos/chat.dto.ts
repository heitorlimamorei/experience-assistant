import { z } from "zod";

export const chatMessageTextContentPartDTOSchema = z.object({
  type: z.literal("text"),
  text: z.string().trim().min(1),
});

export const chatMessageFileContentPartDTOSchema = z.object({
  type: z.literal("file"),
  data: z.string().trim().min(1),
  mediaType: z.string().trim().min(1),
  filename: z.string().trim().min(1).optional(),
});

export const chatMessageContentPartDTOSchema = z.discriminatedUnion("type", [
  chatMessageTextContentPartDTOSchema,
  chatMessageFileContentPartDTOSchema,
]);

export const chatMessageDTOSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.union([
    z.string().trim().min(1),
    z.array(chatMessageContentPartDTOSchema).min(1),
  ]),
});

export const chatRequestDTOSchema = z.object({
  messages: z.array(chatMessageDTOSchema).min(1),
});

export type ChatMessageContentPartDTO = z.infer<
  typeof chatMessageContentPartDTOSchema
>;
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
