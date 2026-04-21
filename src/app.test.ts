import { describe, expect, it } from "bun:test";

import { NewApp } from "./app";
import type { ApplicationDependencies } from "./container/container";
import type { AppConfig } from "./config/config";
import type { ChatRequestDTO, ChatResponseDTO } from "./dtos/chat.dto";
import type { ChatService } from "./services/chat.service";
import type { HealthReader } from "./services/health.service";
import type { WhatsAppWebhookService } from "./services/whatsapp-webhook.service";

const NewFakeHealthService = (): HealthReader => {
  return {
    getStatus: () => {
      return {
        status: "ok" as const,
        service: "experience-assistant",
        openaiConfigured: false,
        defaultModel: "gpt-5.4-mini",
        timestamp: "2026-04-20T00:00:00.000Z",
      };
    },
  };
};

const NewFakeChatService = (): ChatService => {
  return {
    run: async (_input: ChatRequestDTO): Promise<ChatResponseDTO> => {
      return {
        text: "Agora sao 10:00.",
        model: "gpt-5.4-mini",
        steps: 2,
        tools: [
          {
            toolName: "getCurrentDateTime",
            input: {
              locale: "pt-BR",
              timeZone: "America/Sao_Paulo",
            },
          },
        ],
      };
    },
  };
};

const createFakeDependencies = (): ApplicationDependencies => {
  const config: AppConfig = {
    appName: "experience-assistant",
    port: 3000,
    openaiModel: "gpt-5.4-mini",
    openaiAgentMaxSteps: 5,
    twilioWebhookValidateSignature: false,
  };

  return {
    config,
    healthService: NewFakeHealthService(),
    chatService: NewFakeChatService(),
    whatsAppWebhookService: NewFakeWhatsAppWebhookService(),
  };
};

const NewFakeWhatsAppWebhookService = (): WhatsAppWebhookService => {
  return {
    handleIncomingMessage: async () => {
      return 1;
    },
    handleStatusCallback: async () => {},
  };
};

describe("application", () => {
  it("returns health status", async () => {
    const app = NewApp(createFakeDependencies());

    const response = await app.request("/health");
    const body = (await response.json()) as {
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("runs the chat endpoint", async () => {
    const app = NewApp(createFakeDependencies());

    const response = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Que horas sao?",
          },
        ],
      }),
    });

    const body = await response.json();
    const parsedBody = body as {
      tools: Array<{
        toolName: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(parsedBody.tools[0]?.toolName).toBe("getCurrentDateTime");
  });

  it("describes the Twilio WhatsApp message webhook route", async () => {
    const app = NewApp(createFakeDependencies());

    const response = await app.request("/webhooks/twilio/whatsapp/message");
    const body = (await response.json()) as {
      ok: boolean;
      route: string;
      methods: string[];
      provider: string;
      contentType: string;
      respondsWith: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      route: "/webhooks/twilio/whatsapp/message",
      methods: ["GET", "POST"],
      provider: "twilio",
      contentType: "application/x-www-form-urlencoded",
      respondsWith: "text/xml",
    });
  });

  it("describes the Twilio WhatsApp status webhook route", async () => {
    const app = NewApp(createFakeDependencies());

    const response = await app.request("/webhooks/twilio/whatsapp/status");
    const body = (await response.json()) as {
      ok: boolean;
      route: string;
      methods: string[];
      provider: string;
      contentType: string;
      respondsWith: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      route: "/webhooks/twilio/whatsapp/status",
      methods: ["GET", "POST"],
      provider: "twilio",
      contentType: "application/x-www-form-urlencoded",
      respondsWith: "204/200 sem body",
    });
  });

  it("accepts Twilio WhatsApp inbound message payloads", async () => {
    const app = NewApp(createFakeDependencies());

    const response = await app.request("/webhooks/twilio/whatsapp/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        MessageSid: "SM123",
        From: "whatsapp:+5511999999999",
        To: "whatsapp:+14155238886",
        WaId: "5511999999999",
        ProfileName: "Heitor",
        Body: "Oi",
        NumMedia: "0",
      }).toString(),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>");
  });

  it("accepts Twilio WhatsApp status callback payloads", async () => {
    const app = NewApp(createFakeDependencies());

    const response = await app.request("/webhooks/twilio/whatsapp/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        MessageSid: "SM123",
        MessageStatus: "delivered",
        From: "whatsapp:+14155238886",
        To: "whatsapp:+5511999999999",
      }).toString(),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
