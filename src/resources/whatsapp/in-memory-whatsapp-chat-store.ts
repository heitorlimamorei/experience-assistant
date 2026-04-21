import type { ChatMessageDTO } from "../../dtos/chat.dto";

export interface AppendInboundWhatsAppMessagesInput {
  senderId: string;
  messages: Array<{
    messageId: string;
    text: string;
  }>;
}

export interface AppendAssistantWhatsAppMessageInput {
  senderId: string;
  text: string;
}

export interface WhatsAppChatStore {
  getMessages(senderId: string): ChatMessageDTO[];
  appendInboundMessages(
    input: AppendInboundWhatsAppMessagesInput,
  ): ChatMessageDTO[];
  appendAssistantMessage(input: AppendAssistantWhatsAppMessageInput): void;
}

interface ConversationState {
  messages: ChatMessageDTO[];
  processedInboundMessageIds: Set<string>;
}

export const NewInMemoryWhatsAppChatStore = (): WhatsAppChatStore => {
  const conversations = new Map<string, ConversationState>();

  const getConversationState = (senderId: string): ConversationState => {
    const existingState = conversations.get(senderId);

    if (existingState) {
      return existingState;
    }

    const newState: ConversationState = {
      messages: [],
      processedInboundMessageIds: new Set(),
    };

    conversations.set(senderId, newState);

    return newState;
  };

  const getMessages = (senderId: string): ChatMessageDTO[] => {
    const state = conversations.get(senderId);

    if (!state) {
      return [];
    }

    return [...state.messages];
  };

  const appendInboundMessages = ({
    senderId,
    messages,
  }: AppendInboundWhatsAppMessagesInput): ChatMessageDTO[] => {
    const state = getConversationState(senderId);
    const appendedMessages: ChatMessageDTO[] = [];

    for (const message of messages) {
      if (state.processedInboundMessageIds.has(message.messageId)) {
        continue;
      }

      state.processedInboundMessageIds.add(message.messageId);

      const chatMessage: ChatMessageDTO = {
        role: "user",
        content: message.text,
      };

      state.messages.push(chatMessage);
      appendedMessages.push(chatMessage);
    }

    return appendedMessages;
  };

  const appendAssistantMessage = ({
    senderId,
    text,
  }: AppendAssistantWhatsAppMessageInput): void => {
    const state = getConversationState(senderId);

    state.messages.push({
      role: "assistant",
      content: text,
    });
  };

  return {
    getMessages,
    appendInboundMessages,
    appendAssistantMessage,
  };
};
