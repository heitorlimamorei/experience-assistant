import { z } from "zod";

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().optional());

export const twilioIncomingWhatsAppWebhookPayloadSchema = z
  .object({
    // Unique message identifier received from Twilio.
    MessageSid: z.string().trim().min(1),
    // Origin address on the WhatsApp channel, usually in the `whatsapp:+5511...` format.
    From: z.string().trim().min(1),
    // Destination address on the WhatsApp channel, usually your Twilio sender number.
    To: z.string().trim().min(1),
    // Text content sent by the user.
    Body: optionalTrimmedString,
    // Sender WhatsApp ID, typically the phone number in numeric format without `whatsapp:`.
    WaId: optionalTrimmedString,
    // User profile name on WhatsApp, when provided by the platform.
    ProfileName: optionalTrimmedString,
    // Number of media attachments sent with the message.
    NumMedia: optionalTrimmedString,
    // Raw status value sent by Twilio with the message webhook.
    SmsStatus: optionalTrimmedString,
  })
  .passthrough();

export const twilioWhatsAppStatusCallbackPayloadSchema = z
  .object({
    MessageSid: z.string().trim().min(1),
    MessageStatus: z.string().trim().min(1),
    ErrorCode: optionalTrimmedString,
    From: optionalTrimmedString,
    To: optionalTrimmedString,
    ChannelStatusMessage: optionalTrimmedString,
    SmsSid: optionalTrimmedString,
    SmsStatus: optionalTrimmedString,
  })
  .passthrough();

export type TwilioIncomingWhatsAppWebhookPayload = z.infer<
  typeof twilioIncomingWhatsAppWebhookPayloadSchema
>;
export type TwilioWhatsAppStatusCallbackPayload = z.infer<
  typeof twilioWhatsAppStatusCallbackPayloadSchema
>;
