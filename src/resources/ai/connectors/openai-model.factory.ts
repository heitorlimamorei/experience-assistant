import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import type { AppConfig } from "../../../config/config";
import { ApplicationError } from "../../../shared/errors/application.error";

export interface OpenAIModelFactory {
  isConfigured(): boolean;
  createLanguageModel(modelId?: string): LanguageModel;
}

export interface OpenAIModelFactoryDependencies {
  config: AppConfig;
}

export const NewOpenAIModelFactory = ({
  config,
}: OpenAIModelFactoryDependencies): OpenAIModelFactory => {
  let provider: ReturnType<typeof createOpenAI> | undefined;

  return {
    isConfigured: (): boolean => {
      return Boolean(config.openaiApiKey);
    },

    createLanguageModel: (modelId = config.openaiModel): LanguageModel => {
      if (!config.openaiApiKey) {
        throw new ApplicationError(
          503,
          "OPENAI_API_KEY nao configurada. O agente nao pode ser inicializado sem a chave.",
        );
      }

      provider ??= createOpenAI({
        apiKey: config.openaiApiKey,
      });

      return provider.responses(modelId);
    },
  };
};
