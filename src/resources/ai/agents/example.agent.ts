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
import type { FinishWhatsAppChatToolDefinition } from "../tools/finish-whatsapp-chat.tool";
import type { TwilioTableFormatToolDefinition } from "../tools/twilio-table-format.tool";

export interface ExampleAgent {
  generate(
    messages: ModelMessage[],
    onStepFinish?: (step: any) => void,
    options?: ExampleAgentGenerateOptions,
  ): Promise<GenerateTextResult<any, any>>;
}

export interface ExampleAgentGenerateOptions {
  finishWhatsAppChatTool?: FinishWhatsAppChatToolDefinition;
}

export interface ExampleAgentDependencies {
  config: AppConfig;
  modelFactory: OpenAIModelFactory;
  currentDateTimeTool: CurrentDateTimeToolDefinition;
  brazilianInvoiceAnalysisTool: BrazilianInvoiceAnalysisToolDefinition;
  twilioTableFormatTool: TwilioTableFormatToolDefinition;
}

export const NewExampleAgent = ({
  config,
  modelFactory,
  currentDateTimeTool,
  brazilianInvoiceAnalysisTool,
  twilioTableFormatTool,
}: ExampleAgentDependencies): ExampleAgent => {
  return {
    generate: async (
      messages: ModelMessage[],
      onStepFinish?: (step: any) => void,
      options?: ExampleAgentGenerateOptions,
    ): Promise<GenerateTextResult<any, any>> => {
      const agent = new ToolLoopAgent({
        model: modelFactory.createLanguageModel(config.openaiModel),
        instructions: [
          "Voce e um agente de exemplo para a Experience Assistant API.",
          "Responda de forma objetiva e em portugues do Brasil.",
          "Sempre que a pergunta depender de data ou hora atual, use a tool getCurrentDateTime antes de responder.",
          "Quando o usuario pedir analise de nota fiscal brasileira, NFe, NFC-e ou NFS-e, ou enviar imagem/PDF desse tipo de documento, extraia os campos legiveis e use a tool analyzeBrazilianInvoice antes de responder.",
          "Se algum campo da nota estiver ilegivel, envie para a tool apenas os valores em que voce tiver confianca.",
          "Quando precisar apresentar listas de itens, precos, quantidades ou resumos em formato tabular para WhatsApp/Twilio, use a tool formatTwilioTable e devolva a tabela gerada ao usuario.",
          "Quando o usuario pedir para encerrar o atendimento, limpar o historico, resetar a conversa ou comecar do zero no WhatsApp, use a tool finishWhatsAppChat.",
        ].join(" "),
        stopWhen: stepCountIs(config.openaiAgentMaxSteps),
        tools: {
          getCurrentDateTime: currentDateTimeTool,
          analyzeBrazilianInvoice: brazilianInvoiceAnalysisTool,
          formatTwilioTable: twilioTableFormatTool,
          ...(options?.finishWhatsAppChatTool
            ? {
                finishWhatsAppChat: options.finishWhatsAppChatTool,
              }
            : {}),
        },
      });

      return agent.generate({
        messages,
        onStepFinish,
      });
    },
  };
};
