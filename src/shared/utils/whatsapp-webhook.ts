import type {
  TwilioIncomingWhatsAppWebhookPayload,
} from "../../dtos/whatsapp-webhook.dto";
import type {
  ChatMessageContentPartDTO,
  ChatMessageDTO,
  ChatToolTraceDTO,
} from "../../dtos/chat.dto";
import type { FinishWhatsAppChatOutput } from "../../resources/ai/tools/finish-whatsapp-chat.tool";
import type { WhatsAppMessageSender } from "../../resources/whatsapp/connectors/twilio-whatsapp.client";

export interface InboundMessage {
  from: string;
  messageId: string;
  content: ChatMessageDTO["content"];
  profileName?: string;
}

interface InboundMediaDescriptor {
  url: string;
  mediaType?: string;
}

export const hasFinishedWhatsAppChat = (
  toolTraces: ChatToolTraceDTO[],
): boolean => {
  return toolTraces.some((toolTrace) => {
    if (toolTrace.toolName !== "finishWhatsAppChat") {
      return false;
    }

    const output =
      toolTrace.output as Partial<FinishWhatsAppChatOutput> | undefined;

    return output?.ended === true;
  });
};

export const extractInboundMessage = async (
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

export const buildChatMessages = ({
  profileName,
  history,
}: {
  profileName?: string;
  history: ChatMessageDTO[];
}): ChatMessageDTO[] => {
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

const normalizeSenderId = (from: string): string => {
  const withoutPrefix = from.startsWith("whatsapp:")
    ? from.slice("whatsapp:".length)
    : from;

  return withoutPrefix.replace(/\D/g, "");
};
