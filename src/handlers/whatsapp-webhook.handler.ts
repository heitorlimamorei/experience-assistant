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
  const requestUrl = context.req.url;
  const candidateUrls = getTwilioValidationUrls({ config, context });
  const signature =
    context.req.header("x-twilio-signature") ||
    context.req.header("X-Twilio-Signature");

  if (!config.twilioWebhookValidateSignature) {
    console.info("[twilio-whatsapp-webhook] signature validation skipped", {
      url: requestUrl,
      reason: "TWILIO_WEBHOOK_VALIDATE_SIGNATURE=false",
      signatureHeaderPresent: Boolean(signature),
      candidateUrls,
    });

    return;
  }

  if (!config.twilioAuthToken) {
    console.error("[twilio-whatsapp-webhook] signature validation blocked", {
      url: requestUrl,
      reason: "TWILIO_AUTH_TOKEN missing",
      signatureHeaderPresent: Boolean(signature),
      candidateUrls,
    });

    throw new ApplicationError(
      503,
      "TWILIO_AUTH_TOKEN nao foi configurado para validar webhooks.",
    );
  }

  console.info("[twilio-whatsapp-webhook] validating signature", {
    url: requestUrl,
    signatureHeaderPresent: Boolean(signature),
    candidateUrls,
    payloadKeys: Object.keys(requestBody).sort(),
  });

  if (!signature) {
    console.error("[twilio-whatsapp-webhook] signature validation failed", {
      url: requestUrl,
      reason: "X-Twilio-Signature header missing",
      candidateUrls,
    });

    throw new ApplicationError(403, "Assinatura do webhook da Twilio ausente.");
  }

  const matchedUrl = candidateUrls.find((candidateUrl) =>
    twilio.validateRequest(
      config.twilioAuthToken as string,
      signature,
      candidateUrl,
      requestBody,
    ),
  );

  if (!matchedUrl) {
    console.error("[twilio-whatsapp-webhook] signature validation failed", {
      url: requestUrl,
      reason: "signature mismatch",
      candidateUrls,
      payloadKeys: Object.keys(requestBody).sort(),
    });

    throw new ApplicationError(403, "Assinatura do webhook da Twilio invalida.");
  }

  console.info("[twilio-whatsapp-webhook] signature validation passed", {
    url: matchedUrl,
    originalUrl: requestUrl,
    payloadKeys: Object.keys(requestBody).sort(),
  });
};

const getTwilioValidationUrls = ({
  config,
  context,
}: {
  config: AppConfig;
  context: Context;
}): string[] => {
  const rawUrl = new URL(context.req.url);
  const candidateUrls = new Set<string>([rawUrl.toString()]);

  if (config.appBaseUrl) {
    candidateUrls.add(new URL(buildPathWithQuery(rawUrl), config.appBaseUrl).toString());
  }

  const forwardedProto = getFirstForwardedValue(
    context.req.header("x-forwarded-proto"),
  );
  const forwardedHost = getFirstForwardedValue(
    context.req.header("x-forwarded-host") || context.req.header("host"),
  );
  const forwardedPort = getFirstForwardedValue(
    context.req.header("x-forwarded-port"),
  );

  if (forwardedHost) {
    const forwardedUrl = new URL(rawUrl.toString());
    const normalizedProto = forwardedProto || forwardedUrl.protocol.replace(":", "");

    forwardedUrl.protocol = `${normalizedProto}:`;
    forwardedUrl.host = forwardedHost;

    if (
      forwardedPort &&
      !forwardedHost.includes(":") &&
      !isDefaultPort(normalizedProto, forwardedPort)
    ) {
      forwardedUrl.port = forwardedPort;
    }

    candidateUrls.add(forwardedUrl.toString());
  }

  return [...candidateUrls];
};

const buildPathWithQuery = (url: URL): string => {
  return `${url.pathname}${url.search}`;
};

const getFirstForwardedValue = (headerValue?: string): string | undefined => {
  if (!headerValue) {
    return undefined;
  }

  return headerValue
    .split(",")[0]
    ?.trim() || undefined;
};

const isDefaultPort = (protocol: string, port: string): boolean => {
  return (
    (protocol === "https" && port === "443") ||
    (protocol === "http" && port === "80")
  );
};
