import {
  ToolLoopAgent,
  type GenerateTextResult,
  type ModelMessage,
  stepCountIs,
} from "ai";

import type { AppConfig } from "../../../config/config";
import type { OpenAIModelFactory } from "../connectors/openai-model.factory";
import type { BrazilianInvoiceAnalysisToolDefinition } from "../tools/brazilian-invoice-analysis.tool";
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
  brazilianInvoiceAnalysisTool: BrazilianInvoiceAnalysisToolDefinition;
}

export const NewExampleAgent = ({
  config,
  modelFactory,
  currentDateTimeTool,
  brazilianInvoiceAnalysisTool,
}: ExampleAgentDependencies): ExampleAgent => {
  const agent = new ToolLoopAgent({
    model: modelFactory.createLanguageModel(config.openaiModel),
    instructions: [
      "Voce e um agente de exemplo para a Experience Assistant API.",
      "Responda de forma objetiva e em portugues do Brasil.",
      "Sempre que a pergunta depender de data ou hora atual, use a tool getCurrentDateTime antes de responder.",
      "Quando o usuario pedir analise de nota fiscal brasileira, NFe, NFC-e ou NFS-e, ou enviar imagem/PDF desse tipo de documento, extraia os campos legiveis e use a tool analyzeBrazilianInvoice antes de responder.",
      "Se algum campo da nota estiver ilegivel, envie para a tool apenas os valores em que voce tiver confianca.",
    ].join(" "),
    stopWhen: stepCountIs(config.openaiAgentMaxSteps),
    tools: {
      getCurrentDateTime: currentDateTimeTool,
      analyzeBrazilianInvoice: brazilianInvoiceAnalysisTool,
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
