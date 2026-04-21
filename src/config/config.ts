import { z } from "zod";

export interface AppConfig {
  appName: string;
  port: number;
  appBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel: string;
  openaiAgentMaxSteps: number;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioWhatsAppFrom?: string;
  twilioWebhookValidateSignature: boolean;
}

export interface EnvironmentConfigDependencies {
  env?: Record<string, string | undefined>;
}

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.string().trim().url().optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL: z.string().trim().default("gpt-5.4-mini"),
  OPENAI_AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(20).default(5),
  TWILIO_ACCOUNT_SID: z.string().trim().optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().optional(),
  TWILIO_WHATSAPP_FROM: z.string().trim().optional(),
  TWILIO_WEBHOOK_VALIDATE_SIGNATURE: z
    .string()
    .trim()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
});

export const NewEnvironmentConfig = (
  { env = Bun.env }: EnvironmentConfigDependencies = {},
): AppConfig => {
  const parsedConfig = configSchema.parse({
    PORT: env.PORT,
    APP_BASE_URL: env.APP_BASE_URL,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    OPENAI_AGENT_MAX_STEPS: env.OPENAI_AGENT_MAX_STEPS,
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: env.TWILIO_WHATSAPP_FROM,
    TWILIO_WEBHOOK_VALIDATE_SIGNATURE:
      env.TWILIO_WEBHOOK_VALIDATE_SIGNATURE,
  });

  return {
    appName: "experience-assistant",
    port: parsedConfig.PORT,
    appBaseUrl: parsedConfig.APP_BASE_URL || undefined,
    openaiApiKey: parsedConfig.OPENAI_API_KEY || undefined,
    openaiModel: parsedConfig.OPENAI_MODEL,
    openaiAgentMaxSteps: parsedConfig.OPENAI_AGENT_MAX_STEPS,
    twilioAccountSid: parsedConfig.TWILIO_ACCOUNT_SID || undefined,
    twilioAuthToken: parsedConfig.TWILIO_AUTH_TOKEN || undefined,
    twilioWhatsAppFrom: parsedConfig.TWILIO_WHATSAPP_FROM || undefined,
    twilioWebhookValidateSignature:
      parsedConfig.TWILIO_WEBHOOK_VALIDATE_SIGNATURE,
  };
};
