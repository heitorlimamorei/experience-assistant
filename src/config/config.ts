import { z } from "zod";

export interface AppConfig {
  appName: string;
  port: number;
  openaiApiKey?: string;
  openaiModel: string;
  openaiAgentMaxSteps: number;
  metaWebhookVerifyToken?: string;
  metaWhatsAppAccessToken?: string;
  metaWhatsAppPhoneNumberId?: string;
  metaGraphApiVersion: string;
}

export interface EnvironmentConfigDependencies {
  env?: Record<string, string | undefined>;
}

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL: z.string().trim().default("gpt-5.4-mini"),
  OPENAI_AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(20).default(5),
  META_WEBHOOK_VERIFY_TOKEN: z.string().trim().optional(),
  META_WHATSAPP_ACCESS_TOKEN: z.string().trim().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().trim().optional(),
  META_GRAPH_API_VERSION: z.string().trim().default("v23.0"),
});

export const NewEnvironmentConfig = (
  { env = Bun.env }: EnvironmentConfigDependencies = {},
): AppConfig => {
  const parsedConfig = configSchema.parse({
    PORT: env.PORT,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    OPENAI_AGENT_MAX_STEPS: env.OPENAI_AGENT_MAX_STEPS,
    META_WEBHOOK_VERIFY_TOKEN: env.META_WEBHOOK_VERIFY_TOKEN,
    META_WHATSAPP_ACCESS_TOKEN: env.META_WHATSAPP_ACCESS_TOKEN,
    META_WHATSAPP_PHONE_NUMBER_ID: env.META_WHATSAPP_PHONE_NUMBER_ID,
    META_GRAPH_API_VERSION: env.META_GRAPH_API_VERSION,
  });

  return {
    appName: "experience-assistant",
    port: parsedConfig.PORT,
    openaiApiKey: parsedConfig.OPENAI_API_KEY || undefined,
    openaiModel: parsedConfig.OPENAI_MODEL,
    openaiAgentMaxSteps: parsedConfig.OPENAI_AGENT_MAX_STEPS,
    metaWebhookVerifyToken: parsedConfig.META_WEBHOOK_VERIFY_TOKEN || undefined,
    metaWhatsAppAccessToken:
      parsedConfig.META_WHATSAPP_ACCESS_TOKEN || undefined,
    metaWhatsAppPhoneNumberId:
      parsedConfig.META_WHATSAPP_PHONE_NUMBER_ID || undefined,
    metaGraphApiVersion: parsedConfig.META_GRAPH_API_VERSION,
  };
};
