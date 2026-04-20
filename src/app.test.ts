import { describe, expect, it } from "bun:test";

import { NewApp } from "./app";
import type { ApplicationDependencies } from "./container/container";
import type { AppConfig } from "./config/config";
import type { ChatRequestDTO, ChatResponseDTO } from "./dtos/chat.dto";
import type { ChatService } from "./services/chat.service";
import type { HealthReader } from "./services/health.service";

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
  };

  return {
    config,
    healthService: NewFakeHealthService(),
    chatService: NewFakeChatService(),
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
});
