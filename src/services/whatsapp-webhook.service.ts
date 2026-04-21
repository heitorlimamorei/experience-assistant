import type { ChatService } from "./chat.service";
import type {
  TwilioIncomingWhatsAppWebhookPayload,
  TwilioWhatsAppStatusCallbackPayload,
} from "../dtos/whatsapp-webhook.dto";
import type { ChatMessageContentPartDTO, ChatMessageDTO } from "../dtos/chat.dto";
import type { WhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";
import type { WhatsAppMessageSender } from "../resources/whatsapp/connectors/twilio-whatsapp.client";

export interface WhatsAppWebhookService {
  handleIncomingMessage(
    payload: TwilioIncomingWhatsAppWebhookPayload,
  ): Promise<number>;
  handleStatusCallback(
    payload: TwilioWhatsAppStatusCallbackPayload,
  ): Promise<void>;
}

export interface WhatsAppWebhookServiceDependencies {
  chatService: ChatService;
  whatsAppMessageSender: WhatsAppMessageSender;
  whatsAppChatStore: WhatsAppChatStore;
}

interface InboundMessage {
  from: string;
  messageId: string;
  content: ChatMessageDTO["content"];
  profileName?: string;
}

export const NewWhatsAppWebhookService = ({
  chatService,
  whatsAppMessageSender,
  whatsAppChatStore,
}: WhatsAppWebhookServiceDependencies): WhatsAppWebhookService => {
  const handleIncomingMessage = async (
    payload: TwilioIncomingWhatsAppWebhookPayload,
  ): Promise<number> => {
    const inboundMessage = await extractInboundMessage(
      payload,
      whatsAppMessageSender,
    );

    if (!inboundMessage) {
      return 0;
    }

    const appendedMessages = whatsAppChatStore.appendInboundMessages({
      senderId: inboundMessage.from,
      messages: [
        {
          messageId: inboundMessage.messageId,
          content: inboundMessage.content,
        },
      ],
    });

    if (appendedMessages.length === 0) {
      return 0;
    }

    const response = await chatService.run({
      messages: buildChatMessages({
        profileName: inboundMessage.profileName,
        history: whatsAppChatStore.getMessages(inboundMessage.from),
      }),
    });
    const responseText = response.text.trim();

    if (!responseText) {
      return appendedMessages.length;
    }

    whatsAppChatStore.appendAssistantMessage({
      senderId: inboundMessage.from,
      text: responseText,
    });

    await whatsAppMessageSender.sendTextMessage({
      to: inboundMessage.from,
      text: responseText,
    });

    return appendedMessages.length;
  };

  const handleStatusCallback = async (
    payload: TwilioWhatsAppStatusCallbackPayload,
  ): Promise<void> => {
    console.info("[twilio-whatsapp-status] outbound status update", {
      messageSid: payload.MessageSid,
      messageStatus: payload.MessageStatus,
      errorCode: payload.ErrorCode,
      from: payload.From,
      to: payload.To,
      channelStatusMessage: payload.ChannelStatusMessage,
    });
  };

  return {
    handleIncomingMessage,
    handleStatusCallback,
  };
};

const extractInboundMessage = async (
  payload: TwilioIncomingWhatsAppWebhookPayload,
  whatsAppMessageSender: WhatsAppMessageSender,
): Promise<InboundMessage | undefined> => {
  const text = payload.Body?.trim();
  const contentParts: ChatMessageContentPartDTO[] = [];

  if (text) {
    contentParts.push({
      type: "text",
      text,
    });
  }

  const inboundMediaDescriptors = extractInboundMediaDescriptors(payload);

  for (const mediaDescriptor of inboundMediaDescriptors) {
    contentParts.push(
      await mapInboundMediaToChatContentPart(
        mediaDescriptor,
        whatsAppMessageSender,
      ),
    );
  }

  if (contentParts.length === 0) {
    return undefined;
  }

  return {
    from: payload.WaId || normalizeSenderId(payload.From),
    messageId: payload.MessageSid,
    content:
      contentParts.length === 1 && contentParts[0]?.type === "text"
        ? contentParts[0].text
        : contentParts,
    profileName: payload.ProfileName,
  };
};

interface InboundMediaDescriptor {
  url: string;
  mediaType?: string;
}

const extractInboundMediaDescriptors = (
  payload: TwilioIncomingWhatsAppWebhookPayload,
): InboundMediaDescriptor[] => {
  const rawPayload = payload as Record<string, unknown>;
  const mediaCount = Number.parseInt(payload.NumMedia || "0", 10);

  if (!Number.isFinite(mediaCount) || mediaCount <= 0) {
    return [];
  }

  const descriptors: InboundMediaDescriptor[] = [];

  for (let index = 0; index < mediaCount; index += 1) {
    const url = rawPayload[`MediaUrl${index}`];
    const mediaType = rawPayload[`MediaContentType${index}`];

    if (typeof url !== "string" || url.trim().length === 0) {
      continue;
    }

    descriptors.push({
      url: url.trim(),
      mediaType:
        typeof mediaType === "string" && mediaType.trim().length > 0
          ? mediaType.trim()
          : undefined,
    });
  }

  return descriptors;
};

const mapInboundMediaToChatContentPart = async (
  mediaDescriptor: InboundMediaDescriptor,
  whatsAppMessageSender: WhatsAppMessageSender,
): Promise<ChatMessageContentPartDTO> => {
  try {
    const media = await whatsAppMessageSender.readInboundMedia({
      url: mediaDescriptor.url,
    });
    const mediaType = media.mediaType || mediaDescriptor.mediaType;

    if (mediaType && isSupportedModelMediaType(mediaType)) {
      return {
        type: "file",
        data: media.data,
        mediaType,
      };
    }
  } catch (error) {
    console.error("[twilio-whatsapp-webhook] failed to read inbound media", {
      url: mediaDescriptor.url,
      mediaType: mediaDescriptor.mediaType,
      error,
    });
  }

  return {
    type: "text",
    text: buildInboundMediaFallbackText(mediaDescriptor.mediaType),
  };
};

const isSupportedModelMediaType = (mediaType: string): boolean => {
  return mediaType.startsWith("image/") || mediaType === "application/pdf";
};

const buildInboundMediaFallbackText = (mediaType?: string): string => {
  if (mediaType) {
    return `O usuario enviou um anexo no formato ${mediaType}.`;
  }

  return "O usuario enviou um anexo sem tipo de arquivo identificado.";
};

const buildChatMessages = ({
  profileName,
  history,
}: {
  profileName?: string;
  history: ChatMessageDTO[];
}) => {
  const messages: ChatMessageDTO[] = [];

  if (profileName) {
    messages.push({
      role: "system",
      content: `O usuario do WhatsApp se chama ${profileName}.`,
    });
  }

  messages.push(...history);

  return messages;
};

const normalizeSenderId = (from: string): string => {
  const withoutPrefix = from.startsWith("whatsapp:")
    ? from.slice("whatsapp:".length)
    : from;

  return withoutPrefix.replace(/\D/g, "");
};
