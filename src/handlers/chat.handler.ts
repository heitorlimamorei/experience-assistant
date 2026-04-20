import { Hono } from "hono";

import {
  chatRequestDTOSchema,
  type ChatRequestDTO,
} from "../dtos/chat.dto";
import type { ChatService } from "../services/chat.service";
import { ApplicationError } from "../shared/errors/application.error";

export interface ChatHandlerDependencies {
  chatService: ChatService;
}

export const NewChatHandler = ({
  chatService,
}: ChatHandlerDependencies): Hono => {
  const handler = new Hono();

  handler.post("/chat", async (context) => {
    const requestBody = await context.req.json().catch(() => {
      throw new ApplicationError(400, "Body JSON invalido.");
    });

    const parsedRequest = chatRequestDTOSchema.safeParse(requestBody);

    if (!parsedRequest.success) {
      throw new ApplicationError(400, "Payload invalido para /chat.", {
        issues: parsedRequest.error.issues,
      });
    }

    const response = await chatService.run(parsedRequest.data as ChatRequestDTO);

    return context.json(response);
  });

  return handler;
};
