import type { ChatService } from "./chat.service";
import type {
  TwilioIncomingWhatsAppWebhookPayload,
  TwilioWhatsAppStatusCallbackPayload,
} from "../dtos/whatsapp-webhook.dto";
import type { ChatMessageDTO } from "../dtos/chat.dto";
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

interface InboundTextMessage {
  from: string;
  messageId: string;
  text: string;
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
    const inboundMessage = extractInboundTextMessage(payload);

    if (!inboundMessage) {
      return 0;
    }

    const appendedMessages = whatsAppChatStore.appendInboundMessages({
      senderId: inboundMessage.from,
      messages: [
        {
          messageId: inboundMessage.messageId,
          text: inboundMessage.text,
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

const extractInboundTextMessage = (
  payload: TwilioIncomingWhatsAppWebhookPayload,
): InboundTextMessage | undefined => {
  const text = payload.Body?.trim();

  if (!text) {
    return undefined;
  }

  return {
    from: payload.WaId || normalizeSenderId(payload.From),
    messageId: payload.MessageSid,
    text,
    profileName: payload.ProfileName,
  };
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
