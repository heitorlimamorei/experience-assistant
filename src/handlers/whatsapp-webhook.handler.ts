import { Hono, type Context } from "hono";

import {
  whatsAppWebhookPayloadSchema,
  whatsAppWebhookVerificationQuerySchema,
} from "../dtos/whatsapp-webhook.dto";
import type { WhatsAppWebhookService } from "../services/whatsapp-webhook.service";
import { ApplicationError } from "../shared/errors/application.error";

export interface WhatsAppWebhookHandlerDependencies {
  whatsAppWebhookService: WhatsAppWebhookService;
}

export const NewWhatsAppWebhookHandler = ({
  whatsAppWebhookService,
}: WhatsAppWebhookHandlerDependencies): Hono => {
  const handler = new Hono();

  handler.get("/webhooks/meta/whatsapp", (context) => {
    const parsedQuery = whatsAppWebhookVerificationQuerySchema.safeParse(
      context.req.query(),
    );

    if (!parsedQuery.success) {
      throw new ApplicationError(400, "Query invalida para verificacao da Meta.", {
        issues: parsedQuery.error.issues,
      });
    }

    const challenge = whatsAppWebhookService.verifyWebhook(parsedQuery.data);

    return context.text(challenge, 200);
  });

  handler.post("/webhooks/meta/whatsapp", async (context) => {
    const requestBody = await context.req.json().catch(() => {
      throw new ApplicationError(400, "Body JSON invalido.");
    });

    const parsedPayload = whatsAppWebhookPayloadSchema.safeParse(requestBody);

    if (!parsedPayload.success) {
      throw new ApplicationError(400, "Payload invalido para webhook da Meta.", {
        issues: parsedPayload.error.issues,
      });
    }

    const processingPromise = whatsAppWebhookService.handleIncomingWebhook(
      parsedPayload.data,
    );
    const executionCtx = getExecutionContext(context);

    executionCtx?.waitUntil(
      processingPromise.catch((error) => {
        console.error(error);
      }),
    );

    if (!executionCtx) {
      void processingPromise.catch((error) => {
        console.error(error);
      });
    }

    return context.json({ received: true });
  });

  return handler;
};

interface AsyncExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const getExecutionContext = (
  context: Context,
): AsyncExecutionContext | undefined => {
  try {
    return context.executionCtx as AsyncExecutionContext;
  } catch {
    return undefined;
  }
};
