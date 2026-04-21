import { NewEnvironmentConfig, type AppConfig } from "../config/config";
import { NewExampleAgent } from "../resources/ai/agents/example.agent";
import { NewOpenAIModelFactory } from "../resources/ai/connectors/openai-model.factory";
import { NewCurrentDateTimeTool } from "../resources/ai/tools/current-date-time.tool";
import { NewSystemClock } from "../resources/ai/tools/system.clock";
import { NewInMemoryWhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";
import { NewMetaWhatsAppClient } from "../resources/whatsapp/connectors/meta-whatsapp.client";
import { NewChatService, type ChatService } from "../services/chat.service";
import { NewHealthService, type HealthReader } from "../services/health.service";
import {
  NewWhatsAppWebhookService,
  type WhatsAppWebhookService,
} from "../services/whatsapp-webhook.service";

export interface ApplicationDependencies {
  config: AppConfig;
  healthService: HealthReader;
  chatService: ChatService;
  whatsAppWebhookService: WhatsAppWebhookService;
}

export const NewContainer = (): ApplicationDependencies => {
  const config = NewEnvironmentConfig();
  const openAIModelFactory = NewOpenAIModelFactory({ config });
  const currentDateTimeTool = NewCurrentDateTimeTool({
    clock: NewSystemClock(),
  }).tool;
  const whatsAppMessageSender = NewMetaWhatsAppClient({ config });
  const whatsAppChatStore = NewInMemoryWhatsAppChatStore();
  const exampleAgent = NewExampleAgent({
    config,
    modelFactory: openAIModelFactory,
    currentDateTimeTool,
  });
  const chatService = NewChatService({ config, exampleAgent });

  return {
    config,
    healthService: NewHealthService({ config }),
    chatService,
    whatsAppWebhookService: NewWhatsAppWebhookService({
      config,
      chatService,
      whatsAppMessageSender,
      whatsAppChatStore,
    }),
  };
};
