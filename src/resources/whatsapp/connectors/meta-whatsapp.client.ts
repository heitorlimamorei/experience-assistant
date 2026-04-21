import type { AppConfig } from "../../../config/config";
import { ApplicationError } from "../../../shared/errors/application.error";

export interface SendWhatsAppTextMessageInput {
  to: string;
  text: string;
  replyToMessageId?: string;
}

export interface WhatsAppMessageSender {
  sendTextMessage(input: SendWhatsAppTextMessageInput): Promise<void>;
}

export interface MetaWhatsAppClientDependencies {
  config: AppConfig;
}

export const NewMetaWhatsAppClient = ({
  config,
}: MetaWhatsAppClientDependencies): WhatsAppMessageSender => {
  const sendTextMessage = async ({
    to,
    text,
    replyToMessageId,
  }: SendWhatsAppTextMessageInput): Promise<void> => {
    if (!config.metaWhatsAppAccessToken || !config.metaWhatsAppPhoneNumberId) {
      throw new ApplicationError(
        503,
        "Configuracao da Meta WhatsApp incompleta para envio de mensagens.",
      );
    }

    const response = await fetch(
      [
        "https://graph.facebook.com",
        config.metaGraphApiVersion,
        config.metaWhatsAppPhoneNumberId,
        "messages",
      ].join("/"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.metaWhatsAppAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          context: replyToMessageId ? { message_id: replyToMessageId } : undefined,
          text: {
            preview_url: false,
            body: text,
          },
        }),
      },
    );

    if (response.ok) {
      return;
    }

    const errorBody = await response.text();

    throw new ApplicationError(
      502,
      "Falha ao enviar resposta para o WhatsApp da Meta.",
      {
        status: response.status,
        body: errorBody,
      },
    );
  };

  return {
    sendTextMessage,
  };
};
