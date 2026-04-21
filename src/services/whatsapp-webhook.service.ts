import type { ChatService } from "./chat.service";
import type { AppConfig } from "../config/config";
import type {
  WhatsAppWebhookPayload,
  WhatsAppWebhookVerificationQuery,
} from "../dtos/whatsapp-webhook.dto";
import type { ChatMessageDTO } from "../dtos/chat.dto";
import type { WhatsAppChatStore } from "../resources/whatsapp/in-memory-whatsapp-chat-store";
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
  whatsAppChatStore: WhatsAppChatStore;
}

interface InboundTextMessage {
  from: string;
  messageId: string;
  text: string;
  profileName?: string;
}

interface GroupedInboundTextMessages {
  from: string;
  latestMessageId: string;
  profileName?: string;
  messages: InboundTextMessage[];
}

export const NewWhatsAppWebhookService = ({
  config,
  chatService,
  whatsAppMessageSender,
  whatsAppChatStore,
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
    const groupedMessages = groupInboundMessagesBySender(inboundMessages);
    let processedMessagesCount = 0;

    for (const inboundMessageGroup of groupedMessages) {
      const appendedMessages = whatsAppChatStore.appendInboundMessages({
        senderId: inboundMessageGroup.from,
        messages: inboundMessageGroup.messages.map((message) => ({
          messageId: message.messageId,
          text: message.text,
        })),
      });

      if (appendedMessages.length === 0) {
        continue;
      }

      const response = await chatService.run({
        messages: buildChatMessages({
          profileName: inboundMessageGroup.profileName,
          history: whatsAppChatStore.getMessages(inboundMessageGroup.from),
        }),
      });

      const responseText = response.text.trim();
      processedMessagesCount += appendedMessages.length;

      if (!responseText) {
        continue;
      }

      whatsAppChatStore.appendAssistantMessage({
        senderId: inboundMessageGroup.from,
        text: responseText,
      });

      await whatsAppMessageSender.sendTextMessage({
        to: inboundMessageGroup.from,
        text: responseText,
        replyToMessageId: inboundMessageGroup.latestMessageId,
      });
    }

    return processedMessagesCount;
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

const groupInboundMessagesBySender = (
  messages: InboundTextMessage[],
): GroupedInboundTextMessages[] => {
  const groupedMessagesBySender = new Map<string, GroupedInboundTextMessages>();

  for (const message of messages) {
    const existingGroup = groupedMessagesBySender.get(message.from);

    if (existingGroup) {
      existingGroup.messages.push(message);
      existingGroup.latestMessageId = message.messageId;

      if (!existingGroup.profileName && message.profileName) {
        existingGroup.profileName = message.profileName;
      }

      continue;
    }

    groupedMessagesBySender.set(message.from, {
      from: message.from,
      latestMessageId: message.messageId,
      profileName: message.profileName,
      messages: [message],
    });
  }

  return [...groupedMessagesBySender.values()];
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
