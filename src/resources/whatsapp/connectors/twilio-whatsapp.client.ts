import twilio from "twilio";

import type { AppConfig } from "../../../config/config";
import { ApplicationError } from "../../../shared/errors/application.error";

export interface SendWhatsAppTextMessageInput {
  to: string;
  text: string;
}

export interface WhatsAppMessageSender {
  sendTextMessage(input: SendWhatsAppTextMessageInput): Promise<void>;
}

export interface TwilioWhatsAppClientDependencies {
  config: AppConfig;
}

export const NewTwilioWhatsAppClient = ({
  config,
}: TwilioWhatsAppClientDependencies): WhatsAppMessageSender => {
  if (
    !config.twilioAccountSid ||
    !config.twilioAuthToken ||
    !config.twilioWhatsAppFrom
  ) {
    throw new ApplicationError(
      503,
      "Configuracao da Twilio WhatsApp incompleta para envio de mensagens.",
    );
  }

  const accountSid = config.twilioAccountSid;
  const authToken = config.twilioAuthToken;
  const fromAddress = config.twilioWhatsAppFrom;
  const client = twilio(accountSid, authToken);
  const statusCallbackUrl = config.appBaseUrl
    ? new URL("/webhooks/twilio/whatsapp/status", config.appBaseUrl).toString()
    : undefined;

  if (!statusCallbackUrl) {
    console.warn(
      "[twilio-whatsapp-client] APP_BASE_URL nao configurada; status callback nao sera enviado por mensagem.",
    );
  }

  const sendTextMessage = async ({
    to,
    text,
  }: SendWhatsAppTextMessageInput): Promise<void> => {
    try {
      await client.messages.create({
        from: normalizeWhatsAppAddress(fromAddress),
        to: normalizeWhatsAppAddress(to),
        body: text,
        statusCallback: statusCallbackUrl,
      });
    } catch (error) {
      throw new ApplicationError(
        502,
        "Falha ao enviar resposta para o WhatsApp via Twilio.",
        {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : error,
        },
      );
    }
  };

  return {
    sendTextMessage,
  };
};

const normalizeWhatsAppAddress = (value: string): string => {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("whatsapp:")) {
    const number = trimmedValue.slice("whatsapp:".length);

    return `whatsapp:${normalizePhoneNumber(number)}`;
  }

  return `whatsapp:${normalizePhoneNumber(trimmedValue)}`;
};

const normalizePhoneNumber = (value: string): string => {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("+")) {
    return trimmedValue;
  }

  const digitsOnly = trimmedValue.replace(/\D/g, "");

  if (!digitsOnly) {
    return trimmedValue;
  }

  return `+${digitsOnly}`;
};
