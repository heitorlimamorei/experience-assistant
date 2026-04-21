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
    const query = context.req.query();
    const hasVerificationQueryParams =
      Boolean(query["hub.mode"]) ||
      Boolean(query["hub.verify_token"]) ||
      Boolean(query["hub.challenge"]);

    if (!hasVerificationQueryParams) {
      return context.json({
        ok: true,
        route: "/webhooks/meta/whatsapp",
        methods: ["GET", "POST"],
        verification: {
          mode: "subscribe",
          verifyTokenQueryParam: "hub.verify_token",
          challengeQueryParam: "hub.challenge",
        },
      });
    }

    console.info("[meta-whatsapp-webhook] verification request", {
      mode: query["hub.mode"],
      challengePresent: Boolean(query["hub.challenge"]),
      verifyTokenPresent: Boolean(query["hub.verify_token"]),
    });

    const parsedQuery = whatsAppWebhookVerificationQuerySchema.safeParse(
      query,
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

    console.info(
      "[meta-whatsapp-webhook] incoming event",
      summarizeIncomingWebhookRequest(requestBody),
    );

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

const summarizeIncomingWebhookRequest = (requestBody: unknown) => {
  if (!requestBody || typeof requestBody !== "object") {
    return {
      bodyType: typeof requestBody,
    };
  }

  const payload = requestBody as {
    object?: unknown;
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: {
            phone_number_id?: unknown;
            display_phone_number?: unknown;
          };
          messages?: Array<{
            id?: unknown;
            from?: unknown;
            type?: unknown;
          }>;
          statuses?: unknown[];
        };
      }>;
    }>;
  };

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const changes = entries.flatMap((entry) =>
    Array.isArray(entry.changes) ? entry.changes : [],
  );
  const messageEvents = changes.flatMap((change) =>
    Array.isArray(change.value?.messages) ? change.value.messages : [],
  );
  const statusEvents = changes.flatMap((change) =>
    Array.isArray(change.value?.statuses) ? change.value.statuses : [],
  );

  return {
    object: payload.object,
    entryCount: entries.length,
    changeCount: changes.length,
    messageCount: messageEvents.length,
    statusCount: statusEvents.length,
    phoneNumberIds: [
      ...new Set(
        changes
          .map((change) => change.value?.metadata?.phone_number_id)
          .filter((value): value is string => typeof value === "string"),
      ),
    ],
    displayPhoneNumbers: [
      ...new Set(
        changes
          .map((change) => change.value?.metadata?.display_phone_number)
          .filter((value): value is string => typeof value === "string"),
      ),
    ],
    messages: messageEvents.map((message) => ({
      id: typeof message.id === "string" ? message.id : undefined,
      from: typeof message.from === "string" ? message.from : undefined,
      type: typeof message.type === "string" ? message.type : undefined,
    })),
  };
};
