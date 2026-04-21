import { Hono, type Context } from "hono";
import twilio from "twilio";

import {
  twilioIncomingWhatsAppWebhookPayloadSchema,
  twilioWhatsAppStatusCallbackPayloadSchema,
} from "../dtos/whatsapp-webhook.dto";
import type { AppConfig } from "../config/config";
import type { WhatsAppWebhookService } from "../services/whatsapp-webhook.service";
import { ApplicationError } from "../shared/errors/application.error";

export interface WhatsAppWebhookHandlerDependencies {
  config: AppConfig;
  whatsAppWebhookService: WhatsAppWebhookService;
}

export const NewWhatsAppWebhookHandler = ({
  config,
  whatsAppWebhookService,
}: WhatsAppWebhookHandlerDependencies): Hono => {
  const handler = new Hono();

  handler.get("/webhooks/twilio/whatsapp/message", (context) => {
    return context.json({
      ok: true,
      route: "/webhooks/twilio/whatsapp/message",
      methods: ["GET", "POST"],
      provider: "twilio",
      contentType: "application/x-www-form-urlencoded",
      respondsWith: "text/xml",
    });
  });

  handler.get("/webhooks/twilio/whatsapp/status", (context) => {
    return context.json({
      ok: true,
      route: "/webhooks/twilio/whatsapp/status",
      methods: ["GET", "POST"],
      provider: "twilio",
      contentType: "application/x-www-form-urlencoded",
      respondsWith: "204/200 sem body",
    });
  });

  handler.post("/webhooks/twilio/whatsapp/message", async (context) => {
    const requestBody = await readFormUrlEncodedBody(context);
    validateTwilioRequest({
      config,
      context,
      requestBody,
    });

    console.info(
      "[twilio-whatsapp-webhook] incoming message",
      summarizeIncomingWebhookRequest(requestBody),
    );

    const parsedPayload =
      twilioIncomingWhatsAppWebhookPayloadSchema.safeParse(requestBody);

    if (!parsedPayload.success) {
      throw new ApplicationError(400, "Payload invalido para webhook da Twilio.", {
        issues: parsedPayload.error.issues,
      });
    }

    const processingPromise = whatsAppWebhookService.handleIncomingMessage(
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

    const twimlResponse = new twilio.twiml.MessagingResponse();

    return context.body(twimlResponse.toString(), 200, {
      "Content-Type": "text/xml",
    });
  });

  handler.post("/webhooks/twilio/whatsapp/status", async (context) => {
    const requestBody = await readFormUrlEncodedBody(context);
    validateTwilioRequest({
      config,
      context,
      requestBody,
    });

    console.info(
      "[twilio-whatsapp-webhook] status callback",
      summarizeStatusCallbackRequest(requestBody),
    );

    const parsedPayload =
      twilioWhatsAppStatusCallbackPayloadSchema.safeParse(requestBody);

    if (!parsedPayload.success) {
      throw new ApplicationError(
        400,
        "Payload invalido para status callback da Twilio.",
        {
          issues: parsedPayload.error.issues,
        },
      );
    }

    await whatsAppWebhookService.handleStatusCallback(parsedPayload.data);

    return context.body(null, 200);
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

  const payload = requestBody as Record<string, unknown>;

  return {
    messageSid:
      typeof payload.MessageSid === "string" ? payload.MessageSid : undefined,
    from: typeof payload.From === "string" ? payload.From : undefined,
    to: typeof payload.To === "string" ? payload.To : undefined,
    waId: typeof payload.WaId === "string" ? payload.WaId : undefined,
    profileName:
      typeof payload.ProfileName === "string" ? payload.ProfileName : undefined,
    bodyLength:
      typeof payload.Body === "string" ? payload.Body.trim().length : 0,
    numMedia:
      typeof payload.NumMedia === "string" ? payload.NumMedia : undefined,
    smsStatus:
      typeof payload.SmsStatus === "string" ? payload.SmsStatus : undefined,
  };
};

const summarizeStatusCallbackRequest = (requestBody: unknown) => {
  if (!requestBody || typeof requestBody !== "object") {
    return {
      bodyType: typeof requestBody,
    };
  }

  const payload = requestBody as Record<string, unknown>;

  return {
    messageSid:
      typeof payload.MessageSid === "string" ? payload.MessageSid : undefined,
    messageStatus:
      typeof payload.MessageStatus === "string"
        ? payload.MessageStatus
        : undefined,
    errorCode:
      typeof payload.ErrorCode === "string" ? payload.ErrorCode : undefined,
    from: typeof payload.From === "string" ? payload.From : undefined,
    to: typeof payload.To === "string" ? payload.To : undefined,
    smsStatus:
      typeof payload.SmsStatus === "string" ? payload.SmsStatus : undefined,
  };
};

const readFormUrlEncodedBody = async (
  context: Context,
): Promise<Record<string, string>> => {
  const rawBody = await context.req.text();

  return Object.fromEntries(new URLSearchParams(rawBody).entries());
};

const validateTwilioRequest = ({
  config,
  context,
  requestBody,
}: {
  config: AppConfig;
  context: Context;
  requestBody: Record<string, string>;
}) => {
  if (!config.twilioWebhookValidateSignature) {
    return;
  }

  if (!config.twilioAuthToken) {
    throw new ApplicationError(
      503,
      "TWILIO_AUTH_TOKEN nao foi configurado para validar webhooks.",
    );
  }

  const signature =
    context.req.header("x-twilio-signature") ||
    context.req.header("X-Twilio-Signature");

  if (!signature) {
    throw new ApplicationError(403, "Assinatura do webhook da Twilio ausente.");
  }

  const isValidRequest = twilio.validateRequest(
    config.twilioAuthToken,
    signature,
    context.req.url,
    requestBody,
  );

  if (!isValidRequest) {
    throw new ApplicationError(403, "Assinatura do webhook da Twilio invalida.");
  }
};
