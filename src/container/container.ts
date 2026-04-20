import { NewEnvironmentConfig, type AppConfig } from "../config/config";
import { NewExampleAgent } from "../resources/ai/agents/example.agent";
import { NewOpenAIModelFactory } from "../resources/ai/connectors/openai-model.factory";
import { NewCurrentDateTimeTool } from "../resources/ai/tools/current-date-time.tool";
import { NewSystemClock } from "../resources/ai/tools/system.clock";
import { NewChatService, type ChatService } from "../services/chat.service";
import { NewHealthService, type HealthReader } from "../services/health.service";

export interface ApplicationDependencies {
  config: AppConfig;
  healthService: HealthReader;
  chatService: ChatService;
}

export const NewContainer = (): ApplicationDependencies => {
  const config = NewEnvironmentConfig();
  const openAIModelFactory = NewOpenAIModelFactory({ config });
  const currentDateTimeTool = NewCurrentDateTimeTool({
    clock: NewSystemClock(),
  }).tool;
  const exampleAgent = NewExampleAgent({
    config,
    modelFactory: openAIModelFactory,
    currentDateTimeTool,
  });

  return {
    config,
    healthService: NewHealthService({ config }),
    chatService: NewChatService({ config, exampleAgent }),
  };
};
