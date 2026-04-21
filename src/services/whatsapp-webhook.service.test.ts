import { describe, expect, it } from "bun:test";

import type { AppConfig } from "../config/config";
import type { ChatRequestDTO, ChatResponseDTO } from "../dtos/chat.dto";
import { NewInMemoryWhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";
import type {
  SendWhatsAppTextMessageInput,
  WhatsAppMessageSender,
} from "../resources/whatsapp/connectors/twilio-whatsapp.client";
import type { ChatService } from "./chat.service";
import { NewWhatsAppWebhookService } from "./whatsapp-webhook.service";

const config: AppConfig = {
  appName: "experience-assistant",
  port: 3000,
  openaiModel: "gpt-5.4-mini",
  openaiAgentMaxSteps: 5,
  twilioWebhookValidateSignature: false,
};

describe("whatsapp webhook service", () => {
  it("processes an inbound Twilio WhatsApp message and persists the conversation in memory", async () => {
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
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    await service.handleIncomingMessage({
      MessageSid: "SM-1",
      From: "whatsapp:+5511999999999",
      To: "whatsapp:+14155238886",
      WaId: "5511999999999",
      ProfileName: "Heitor",
      Body: "Quero ajuda com a viagem",
      NumMedia: "0",
    });

    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0]?.messages).toEqual([
      {
        role: "system",
        content: "O usuario do WhatsApp se chama Heitor.",
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
      },
    ]);
    expect(whatsAppChatStore.getMessages("5511999999999")).toEqual([
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
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    await service.handleIncomingMessage({
      MessageSid: "SM-1",
      From: "whatsapp:+5511999999999",
      To: "whatsapp:+14155238886",
      WaId: "5511999999999",
      Body: "Primeira mensagem",
    });

    await service.handleIncomingMessage({
      MessageSid: "SM-1",
      From: "whatsapp:+5511999999999",
      To: "whatsapp:+14155238886",
      WaId: "5511999999999",
      Body: "Primeira mensagem",
    });

    await service.handleIncomingMessage({
      MessageSid: "SM-2",
      From: "whatsapp:+5511999999999",
      To: "whatsapp:+14155238886",
      WaId: "5511999999999",
      Body: "Segunda mensagem",
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
      },
      {
        to: "5511999999999",
        text: "Resposta 2",
      },
    ]);
  });

  it("ignores inbound webhook payloads without text body", async () => {
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
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    const processedMessagesCount = await service.handleIncomingMessage({
      MessageSid: "SM-3",
      From: "whatsapp:+5511999999999",
      To: "whatsapp:+14155238886",
      WaId: "5511999999999",
      Body: "",
      NumMedia: "1",
    });

    expect(processedMessagesCount).toBe(0);
    expect(chatRequests).toHaveLength(0);
    expect(sentMessages).toHaveLength(0);
  });

  it("accepts Twilio status callbacks without affecting the conversation history", async () => {
    const whatsAppChatStore = NewInMemoryWhatsAppChatStore();

    const chatService: ChatService = {
      run: async (): Promise<ChatResponseDTO> => {
        return {
          text: "Nao deveria ser chamado.",
          model: "gpt-5.4-mini",
          steps: 1,
          tools: [],
        };
      },
    };

    const whatsAppMessageSender: WhatsAppMessageSender = {
      sendTextMessage: async () => {},
    };

    const service = NewWhatsAppWebhookService({
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    });

    await service.handleStatusCallback({
      MessageSid: "SM-4",
      MessageStatus: "delivered",
      From: "whatsapp:+14155238886",
      To: "whatsapp:+5511999999999",
    });

    expect(whatsAppChatStore.getMessages("5511999999999")).toEqual([]);
  });
});
