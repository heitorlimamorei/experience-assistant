import type { Context } from "hono";
import twilio from "twilio";

import type { AppConfig } from "../config/config";
import { ApplicationError } from "./errors/application.error";

export const validateTwilioRequest = ({
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
    candidateUrls.add(
      new URL(buildPathWithQuery(rawUrl), config.appBaseUrl).toString(),
    );
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
    const normalizedProto =
      forwardedProto || forwardedUrl.protocol.replace(":", "");

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

  return headerValue.split(",")[0]?.trim() || undefined;
};

const isDefaultPort = (protocol: string, port: string): boolean => {
  return (
    (protocol === "https" && port === "443") ||
    (protocol === "http" && port === "80")
  );
};
