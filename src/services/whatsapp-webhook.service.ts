import type { ChatService } from "./chat.service";
import type {
  TwilioIncomingWhatsAppWebhookPayload,
  TwilioWhatsAppStatusCallbackPayload,
} from "../dtos/whatsapp-webhook.dto";
import type { WhatsAppMessageSender } from "../resources/whatsapp/connectors/twilio-whatsapp.client";
import type { WhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";
import {
  buildChatMessages,
  extractInboundMessage,
  hasFinishedWhatsAppChat,
} from "../shared/utils/whatsapp-webhook";

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
    }, {
      senderId: inboundMessage.from,
    });
    const responseText = response.text.trim();
    const endedChat = hasFinishedWhatsAppChat(response.tools);

    if (!responseText) {
      return appendedMessages.length;
    }

    if (!endedChat) {
      whatsAppChatStore.appendAssistantMessage({
        senderId: inboundMessage.from,
        text: responseText,
      });
    }

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
