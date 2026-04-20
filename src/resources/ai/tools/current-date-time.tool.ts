import { tool } from "ai";
import { z } from "zod";

import type { Clock } from "./system.clock";

export type CurrentDateTimeToolDefinition = ReturnType<typeof tool<
  {
    locale: string;
    timeZone: string;
  },
  {
    iso: string;
    locale: string;
    timeZone: string;
    formatted: string;
  }
>>;

export interface CurrentDateTimeTool {
  tool: CurrentDateTimeToolDefinition;
}

export interface CurrentDateTimeToolDependencies {
  clock: Clock;
}

export const NewCurrentDateTimeTool = ({
  clock,
}: CurrentDateTimeToolDependencies): CurrentDateTimeTool => {
  return {
    tool: tool({
      description:
        "Retorna a data e hora atuais. Use quando o usuario pedir horario, data atual ou precisar de referencia temporal.",
      inputSchema: z.object({
        locale: z
          .string()
          .default("pt-BR")
          .describe("Locale para formatacao, por exemplo pt-BR ou en-US."),
        timeZone: z
          .string()
          .default("America/Sao_Paulo")
          .describe("Time zone IANA, por exemplo America/Sao_Paulo."),
      }),
      execute: async ({ locale, timeZone }) => {
        const currentDate = clock.now();

        return {
          iso: currentDate.toISOString(),
          locale,
          timeZone,
          formatted: new Intl.DateTimeFormat(locale, {
            dateStyle: "full",
            timeStyle: "long",
            timeZone,
          }).format(currentDate),
        };
      },
    }),
  };
};
