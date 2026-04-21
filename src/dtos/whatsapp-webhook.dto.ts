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
    MessageSid: z.string().trim().min(1),
    From: z.string().trim().min(1),
    To: z.string().trim().min(1),
    Body: optionalTrimmedString,
    WaId: optionalTrimmedString,
    ProfileName: optionalTrimmedString,
    NumMedia: optionalTrimmedString,
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
