import { describe, expect, it } from "bun:test";

import type { AppConfig } from "../config/config";
import type { ChatRequestDTO, ChatResponseDTO } from "../dtos/chat.dto";
import { NewInMemoryWhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";
import type {
  SendWhatsAppTextMessageInput,
  WhatsAppMessageSender,
} from "../resources/whatsapp/connectors/meta-whatsapp.client";
import type { ChatService } from "./chat.service";
import { NewWhatsAppWebhookService } from "./whatsapp-webhook.service";

const config: AppConfig = {
  appName: "experience-assistant",
  port: 3000,
  openaiModel: "gpt-5.4-mini",
  openaiAgentMaxSteps: 5,
  metaGraphApiVersion: "v23.0",
};

describe("whatsapp webhook service", () => {
  it("groups inbound messages by sender and persists the conversation in memory", async () => {
    const chatRequests: ChatRequestDTO[] = [];
    const sentMessages: SendWhatsAppTextMessageInput[] = [];
    const whatsAppChatStore = NewInMemoryWhatsAppChatStore();

    const chatService: ChatService = {
      run: async (input): Promise<ChatResponseDTO> => {
        chatRequests.push(input);

        return {
          text: "Resposta consolidada.",
          model: "gpt-5.4-mini",
          steps: 1,
          tools: [],
        };
      },
    };

    const whatsAppMessageSender: WhatsAppMessageSender = {
      sendTextMessage: async (input) => {
        sentMessages.push(input);
      },
    };

    const service = NewWhatsAppWebhookService({
      config,
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    await service.handleIncomingWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [
                  {
                    wa_id: "5511999999999",
                    profile: {
                      name: "Heitor",
                    },
                  },
                ],
                messages: [
                  {
                    id: "wamid-1",
                    from: "5511999999999",
                    type: "text",
                    text: {
                      body: "Oi",
                    },
                  },
                  {
                    id: "wamid-2",
                    from: "5511999999999",
                    type: "text",
                    text: {
                      body: "Quero ajuda com a viagem",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0]?.messages).toEqual([
      {
        role: "system",
        content: "O usuario do WhatsApp se chama Heitor.",
      },
      {
        role: "user",
        content: "Oi",
      },
      {
        role: "user",
        content: "Quero ajuda com a viagem",
      },
    ]);
    expect(sentMessages).toEqual([
      {
        to: "5511999999999",
        text: "Resposta consolidada.",
        replyToMessageId: "wamid-2",
      },
    ]);
    expect(whatsAppChatStore.getMessages("5511999999999")).toEqual([
      {
        role: "user",
        content: "Oi",
      },
      {
        role: "user",
        content: "Quero ajuda com a viagem",
      },
      {
        role: "assistant",
        content: "Resposta consolidada.",
      },
    ]);
  });

  it("reuses the stored conversation and ignores duplicate inbound message ids", async () => {
    const chatRequests: ChatRequestDTO[] = [];
    const sentMessages: SendWhatsAppTextMessageInput[] = [];
    const whatsAppChatStore = NewInMemoryWhatsAppChatStore();

    const chatService: ChatService = {
      run: async (input): Promise<ChatResponseDTO> => {
        chatRequests.push(input);

        return {
          text: `Resposta ${chatRequests.length}`,
          model: "gpt-5.4-mini",
          steps: 1,
          tools: [],
        };
      },
    };

    const whatsAppMessageSender: WhatsAppMessageSender = {
      sendTextMessage: async (input) => {
        sentMessages.push(input);
      },
    };

    const service = NewWhatsAppWebhookService({
      config,
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    await service.handleIncomingWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid-1",
                    from: "5511999999999",
                    type: "text",
                    text: {
                      body: "Primeira mensagem",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    await service.handleIncomingWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid-1",
                    from: "5511999999999",
                    type: "text",
                    text: {
                      body: "Primeira mensagem",
                    },
                  },
                  {
                    id: "wamid-2",
                    from: "5511999999999",
                    type: "text",
                    text: {
                      body: "Segunda mensagem",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(chatRequests).toHaveLength(2);
    expect(chatRequests[1]?.messages).toEqual([
      {
        role: "user",
        content: "Primeira mensagem",
      },
      {
        role: "assistant",
        content: "Resposta 1",
      },
      {
        role: "user",
        content: "Segunda mensagem",
      },
    ]);
    expect(sentMessages).toEqual([
      {
        to: "5511999999999",
        text: "Resposta 1",
        replyToMessageId: "wamid-1",
      },
      {
        to: "5511999999999",
        text: "Resposta 2",
        replyToMessageId: "wamid-2",
      },
    ]);
  });

  it("ignores webhook payloads that only contain delivery statuses", async () => {
    const chatRequests: ChatRequestDTO[] = [];
    const sentMessages: SendWhatsAppTextMessageInput[] = [];
    const whatsAppChatStore = NewInMemoryWhatsAppChatStore();

    const chatService: ChatService = {
      run: async (input): Promise<ChatResponseDTO> => {
        chatRequests.push(input);

        return {
          text: "Nao deveria ser chamado.",
          model: "gpt-5.4-mini",
          steps: 1,
          tools: [],
        };
      },
    };

    const whatsAppMessageSender: WhatsAppMessageSender = {
      sendTextMessage: async (input) => {
        sentMessages.push(input);
      },
    };

    const service = NewWhatsAppWebhookService({
      config,
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    const processedMessagesCount = await service.handleIncomingWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: "1125733920617385",
                },
                statuses: [
                  {
                    id: "wamid-1",
                    status: "failed",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(processedMessagesCount).toBe(0);
    expect(chatRequests).toHaveLength(0);
    expect(sentMessages).toHaveLength(0);
  });
});
