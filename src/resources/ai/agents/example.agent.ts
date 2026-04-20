import {
  ToolLoopAgent,
  type GenerateTextResult,
  type ModelMessage,
  stepCountIs,
} from "ai";

import type { AppConfig } from "../../../config/config";
import type { OpenAIModelFactory } from "../connectors/openai-model.factory";
import type { CurrentDateTimeToolDefinition } from "../tools/current-date-time.tool";

export interface ExampleAgent {
  generate(
    messages: ModelMessage[],
    onStepFinish?: (step: any) => void,
  ): Promise<GenerateTextResult<any, any>>;
}

export interface ExampleAgentDependencies {
  config: AppConfig;
  modelFactory: OpenAIModelFactory;
  currentDateTimeTool: CurrentDateTimeToolDefinition;
}

export const NewExampleAgent = ({
  config,
  modelFactory,
  currentDateTimeTool,
}: ExampleAgentDependencies): ExampleAgent => {
  const agent = new ToolLoopAgent({
    model: modelFactory.createLanguageModel(config.openaiModel),
    instructions: [
      "Voce e um agente de exemplo para a Experience Assistant API.",
      "Responda de forma objetiva e em portugues do Brasil.",
      "Sempre que a pergunta depender de data ou hora atual, use a tool getCurrentDateTime antes de responder.",
    ].join(" "),
    stopWhen: stepCountIs(config.openaiAgentMaxSteps),
    tools: {
      getCurrentDateTime: currentDateTimeTool,
    },
  });

  return {
    generate: async (
      messages: ModelMessage[],
      onStepFinish?: (step: any) => void,
    ): Promise<GenerateTextResult<any, any>> => {
      return agent.generate({
        messages,
        onStepFinish,
      });
    },
  };
};
