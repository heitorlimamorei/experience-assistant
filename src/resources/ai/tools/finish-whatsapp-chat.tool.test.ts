import { describe, expect, it } from "bun:test";

import { NewInMemoryWhatsAppChatStore } from "../../whatsapp/in-memory-whatsapp-chat-store";
import {
  NewFinishWhatsAppChatTool,
  type FinishWhatsAppChatOutput,
} from "./finish-whatsapp-chat.tool";

describe("finish whatsapp chat tool", () => {
  it("clears the current user conversation from the in-memory store", async () => {
    const whatsAppChatStore = NewInMemoryWhatsAppChatStore();

    whatsAppChatStore.appendInboundMessages({
      senderId: "5511999999999",
      messages: [
        {
          messageId: "SM-1",
          content: "Oi",
        },
      ],
    });
    whatsAppChatStore.appendAssistantMessage({
      senderId: "5511999999999",
      text: "Como posso ajudar?",
    });

    const output = (await NewFinishWhatsAppChatTool({
      senderId: "5511999999999",
      whatsAppChatStore,
    }).tool.execute!(
      {
        reason: "user_requested",
      },
      {
        toolCallId: "tool-call-test",
        messages: [],
      },
    )) as FinishWhatsAppChatOutput;

    expect(output.ended).toBe(true);
    expect(output.removedMessages).toBe(2);
    expect(output.removedProcessedMessageIds).toBe(1);
    expect(whatsAppChatStore.getMessages("5511999999999")).toEqual([]);
  });

  it("reports when the conversation was already empty", async () => {
    const whatsAppChatStore = NewInMemoryWhatsAppChatStore();
    const output = (await NewFinishWhatsAppChatTool({
      senderId: "5511999999999",
      whatsAppChatStore,
    }).tool.execute!(
      {},
      {
        toolCallId: "tool-call-test",
        messages: [],
      },
    )) as FinishWhatsAppChatOutput;

    expect(output.ended).toBe(true);
    expect(output.removedMessages).toBe(0);
    expect(output.message).toContain("ja estava vazia");
  });
});
