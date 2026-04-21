import type { ChatService } from "./chat.service";
import type { AppConfig } from "../config/config";
import type {
  WhatsAppWebhookPayload,
  WhatsAppWebhookVerificationQuery,
} from "../dtos/whatsapp-webhook.dto";
import type { WhatsAppMessageSender } from "../resources/whatsapp/connectors/meta-whatsapp.client";
import { ApplicationError } from "../shared/errors/application.error";

export interface WhatsAppWebhookService {
  verifyWebhook(query: WhatsAppWebhookVerificationQuery): string;
  handleIncomingWebhook(payload: WhatsAppWebhookPayload): Promise<number>;
}

export interface WhatsAppWebhookServiceDependencies {
  config: AppConfig;
  chatService: ChatService;
  whatsAppMessageSender: WhatsAppMessageSender;
}

interface InboundTextMessage {
  from: string;
  messageId: string;
  text: string;
  profileName?: string;
}

export const NewWhatsAppWebhookService = ({
  config,
  chatService,
  whatsAppMessageSender,
}: WhatsAppWebhookServiceDependencies): WhatsAppWebhookService => {
  const verifyWebhook = (query: WhatsAppWebhookVerificationQuery): string => {
    const mode = query["hub.mode"];
    const verifyToken = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (!config.metaWebhookVerifyToken) {
      throw new ApplicationError(
        503,
        "META_WEBHOOK_VERIFY_TOKEN nao foi configurado.",
      );
    }

    if (
      mode !== "subscribe" ||
      verifyToken !== config.metaWebhookVerifyToken ||
      !challenge
    ) {
      throw new ApplicationError(403, "Falha na verificacao do webhook da Meta.");
    }

    return challenge;
  };

  const handleIncomingWebhook = async (
    payload: WhatsAppWebhookPayload,
  ): Promise<number> => {
    const inboundMessages = extractInboundTextMessages(payload);

    for (const inboundMessage of inboundMessages) {
      const response = await chatService.run({
        messages: buildChatMessages(inboundMessage),
      });

      const responseText = response.text.trim();

      if (!responseText) {
        continue;
      }

      await whatsAppMessageSender.sendTextMessage({
        to: inboundMessage.from,
        text: responseText,
        replyToMessageId: inboundMessage.messageId,
      });
    }

    return inboundMessages.length;
  };

  return {
    verifyWebhook,
    handleIncomingWebhook,
  };
};

const extractInboundTextMessages = (
  payload: WhatsAppWebhookPayload,
): InboundTextMessage[] => {
  const messages: InboundTextMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const contactsByWaId = new Map(
        (change.value.contacts || [])
          .filter((contact) => contact.wa_id)
          .map((contact) => [contact.wa_id as string, contact.profile?.name]),
      );

      for (const message of change.value.messages || []) {
        if (message.type !== "text" || !message.text?.body?.trim()) {
          continue;
        }

        messages.push({
          from: message.from,
          messageId: message.id,
          text: message.text.body.trim(),
          profileName: contactsByWaId.get(message.from),
        });
      }
    }
  }

  return messages;
};

const buildChatMessages = (message: InboundTextMessage) => {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (message.profileName) {
    messages.push({
      role: "system",
      content: `O usuario do WhatsApp se chama ${message.profileName}.`,
    });
  }

  messages.push({
    role: "user",
    content: message.text,
  });

  return messages;
};
