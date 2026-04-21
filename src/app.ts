import { Hono } from "hono";

import type { ApplicationDependencies } from "./container/container";
import { NewChatHandler } from "./handlers/chat.handler";
import { NewHealthHandler } from "./handlers/health.handler";
import { NewWhatsAppWebhookHandler } from "./handlers/whatsapp-webhook.handler";
import { ApplicationError } from "./shared/errors/application.error";

export const NewApp = (dependencies: ApplicationDependencies): Hono => {
  const app = new Hono();

  app.get("/", (context) => {
    return context.json({
      service: dependencies.config.appName,
      status: "running",
      docs: {
        health: "GET /health",
        chat: "POST /chat",
        whatsAppWebhook: [
          "GET /webhooks/twilio/whatsapp/message",
          "POST /webhooks/twilio/whatsapp/message",
          "GET /webhooks/twilio/whatsapp/status",
          "POST /webhooks/twilio/whatsapp/status",
        ],
      },
    });
  });

  app.route("/", NewHealthHandler(dependencies.healthService));
  app.route(
    "/",
    NewChatHandler({
      chatService: dependencies.chatService,
    }),
  );
  app.route(
    "/",
    NewWhatsAppWebhookHandler({
      config: dependencies.config,
      whatsAppWebhookService: dependencies.whatsAppWebhookService,
    }),
  );

  app.notFound((context) => {
    return context.json(
      {
        error: "Rota nao encontrada.",
      },
      404,
    );
  });

  app.onError((error, context) => {
    if (error instanceof ApplicationError) {
      context.status(
        error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
      );

      return context.json({
        error: error.message,
        details: error.details,
      });
    }

    console.error(error);

    return context.json(
      {
        error: "Erro interno inesperado.",
      },
      500,
    );
  });

  return app;
};
