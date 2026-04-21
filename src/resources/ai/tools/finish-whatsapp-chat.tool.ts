import { tool } from "ai";
import { z } from "zod";

import type { WhatsAppChatStore } from "../../whatsapp/in-memory-whatsapp-chat-store";

export const finishWhatsAppChatInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("Motivo opcional para encerrar a conversa."),
});

export interface FinishWhatsAppChatToolDependencies {
  senderId: string;
  whatsAppChatStore: Pick<WhatsAppChatStore, "clearConversation">;
}

export interface FinishWhatsAppChatOutput {
  ended: boolean;
  removedMessages: number;
  removedProcessedMessageIds: number;
  message: string;
}

export type FinishWhatsAppChatToolDefinition = ReturnType<
  typeof tool<z.infer<typeof finishWhatsAppChatInputSchema>, FinishWhatsAppChatOutput>
>;

export interface FinishWhatsAppChatTool {
  tool: FinishWhatsAppChatToolDefinition;
}

export const NewFinishWhatsAppChatTool = ({
  senderId,
  whatsAppChatStore,
}: FinishWhatsAppChatToolDependencies): FinishWhatsAppChatTool => {
  return {
    tool: tool({
      description:
        "Finaliza a conversa atual do WhatsApp e limpa o cache da sessao do usuario no chat store em memoria. Use quando o usuario pedir para encerrar, reiniciar, limpar historico ou comecar uma conversa do zero.",
      inputSchema: finishWhatsAppChatInputSchema,
      execute: async (input): Promise<FinishWhatsAppChatOutput> => {
        const result = whatsAppChatStore.clearConversation(senderId);
        const reasonSuffix = input.reason ? ` Motivo: ${input.reason}.` : "";

        return {
          ended: true,
          removedMessages: result.removedMessages,
          removedProcessedMessageIds: result.removedProcessedMessageIds,
          message: result.existed
            ? `Conversa encerrada e cache do usuario limpo.${reasonSuffix}`
            : `A conversa ja estava vazia.${reasonSuffix}`,
        };
      },
    }),
  };
};
