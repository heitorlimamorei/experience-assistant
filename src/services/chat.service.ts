import { Buffer } from "node:buffer";

import type { ModelMessage } from "ai";

import type {
  ChatMessageDTO,
  ChatMessageContentPartDTO,
  ChatRequestDTO,
  ChatResponseDTO,
  ChatToolTraceDTO,
} from "../dtos/chat.dto";
import type { AppConfig } from "../config/config";
import type { ExampleAgent } from "../resources/ai/agents/example.agent";
import { NewFinishWhatsAppChatTool } from "../resources/ai/tools/finish-whatsapp-chat.tool";
import type { WhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";

export interface ChatService {
  run(input: ChatRequestDTO, options?: ChatRunOptions): Promise<ChatResponseDTO>;
}

export interface ChatServiceDependencies {
  config: AppConfig;
  exampleAgent: ExampleAgent;
  whatsAppChatStore: WhatsAppChatStore;
}

export interface ChatRunOptions {
  senderId?: string;
}

export const NewChatService = ({
  config,
  exampleAgent,
  whatsAppChatStore,
}: ChatServiceDependencies): ChatService => {
  const run = async (
    input: ChatRequestDTO,
    options?: ChatRunOptions,
  ): Promise<ChatResponseDTO> => {
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
      options?.senderId
        ? {
            finishWhatsAppChatTool: NewFinishWhatsAppChatTool({
              senderId: options.senderId,
              whatsAppChatStore,
            }).tool,
          }
        : undefined,
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
  if (typeof message.content === "string") {
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
  }

  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: mapContentPartsToPlainText(message.content),
      };
    case "assistant":
      return {
        role: "assistant",
        content: [
          {
            type: "text",
            text: mapContentPartsToPlainText(message.content),
          },
        ],
      };
    case "user":
      return {
        role: "user",
        content: message.content.map(mapChatMessageContentPartDTOToModelPart),
      };
  }
};

const mapChatMessageContentPartDTOToModelPart = (
  part: ChatMessageContentPartDTO,
) => {
  switch (part.type) {
    case "text":
      return {
        type: "text" as const,
        text: part.text,
      };
    case "file":
      return {
        type: "file" as const,
        data: Buffer.from(part.data, "base64"),
        mediaType: part.mediaType,
        filename: part.filename,
      };
  }
};

const mapContentPartsToPlainText = (
  parts: ChatMessageContentPartDTO[],
): string => {
  return parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.text;
        case "file":
          return `[Attachment: ${part.mediaType}]`;
      }
    })
    .join("\n");
};
