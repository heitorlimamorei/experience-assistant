import { z } from "zod";

export const whatsAppWebhookVerificationQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});

const whatsAppWebhookMessageSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    type: z.string(),
    text: z
      .object({
        body: z.string().trim().min(1),
      })
      .optional(),
  })
  .passthrough();

export const whatsAppWebhookPayloadSchema = z
  .object({
    object: z.literal("whatsapp_business_account"),
    entry: z.array(
      z
        .object({
          changes: z.array(
            z
              .object({
                value: z
                  .object({
                    contacts: z
                      .array(
                        z
                          .object({
                            wa_id: z.string().optional(),
                            profile: z
                              .object({
                                name: z.string().optional(),
                              })
                              .optional(),
                          })
                          .passthrough(),
                      )
                      .optional(),
                    messages: z.array(whatsAppWebhookMessageSchema).optional(),
                    metadata: z
                      .object({
                        display_phone_number: z.string().optional(),
                        phone_number_id: z.string().optional(),
                      })
                      .passthrough()
                      .optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type WhatsAppWebhookVerificationQuery = z.infer<
  typeof whatsAppWebhookVerificationQuerySchema
>;
export type WhatsAppWebhookPayload = z.infer<typeof whatsAppWebhookPayloadSchema>;
