import type { ModelMessage } from "ai";

import type {
  ChatMessageDTO,
  ChatRequestDTO,
  ChatResponseDTO,
  ChatToolTraceDTO,
} from "../dtos/chat.dto";
import type { AppConfig } from "../config/config";
import type { ExampleAgent } from "../resources/ai/agents/example.agent";

export interface ChatService {
  run(input: ChatRequestDTO): Promise<ChatResponseDTO>;
}

export interface ChatServiceDependencies {
  config: AppConfig;
  exampleAgent: ExampleAgent;
}

export const NewChatService = ({
  config,
  exampleAgent,
}: ChatServiceDependencies): ChatService => {
  const run = async (input: ChatRequestDTO): Promise<ChatResponseDTO> => {
    const toolTraces: ChatToolTraceDTO[] = [];
    let model = config.openaiModel;
    let steps = 0;

    const result = await exampleAgent.generate(
      input.messages.map(mapChatMessageDTOToModelMessage),
      (step) => {
        model = step.model.modelId;
        steps = step.stepNumber + 1;

        const toolOutputs = new Map(
          step.toolResults.map((toolResult: any) => [
            toolResult.toolCallId,
            toolResult.output,
          ]),
        );

        for (const toolCall of step.toolCalls) {
          toolTraces.push({
            toolName: toolCall.toolName,
            input: toolCall.input,
            output: toolOutputs.get(toolCall.toolCallId),
          });
        }
      },
    );

    return {
      text: result.text,
      model,
      steps,
      tools: toolTraces,
    };
  };

  return {
    run,
  };
};

const mapChatMessageDTOToModelMessage = (
  message: ChatMessageDTO,
): ModelMessage => {
  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: message.content,
      };
    case "assistant":
      return {
        role: "assistant",
        content: [{ type: "text", text: message.content }],
      };
    case "user":
      return {
        role: "user",
        content: [{ type: "text", text: message.content }],
      };
  }
};
