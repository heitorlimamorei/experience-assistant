import { tool } from "ai";
import { z } from "zod";

const twilioTableColumnSchema = z.object({
  key: z.string().trim().min(1).describe("Identificador da coluna."),
  label: z.string().trim().min(1).describe("Titulo visivel da coluna."),
  maxWidth: z
    .number()
    .int()
    .min(3)
    .max(40)
    .optional()
    .describe("Largura maxima da coluna."),
  align: z
    .enum(["left", "right"])
    .default("left")
    .describe("Alinhamento do texto na coluna."),
});

const twilioTableRowSchema = z.record(
  z.string().trim().min(1),
  z.union([z.string(), z.number(), z.null()]),
);

export const twilioTableFormatInputSchema = z.object({
  title: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe("Titulo opcional da tabela."),
  columns: z
    .array(twilioTableColumnSchema)
    .min(1)
    .max(8)
    .describe("Definicao das colunas da tabela."),
  rows: z
    .array(twilioTableRowSchema)
    .min(1)
    .max(50)
    .describe("Linhas de dados da tabela."),
  footer: z
    .array(z.string().trim().min(1).max(120))
    .max(5)
    .default([])
    .describe("Linhas finais opcionais, como total ou observacoes."),
  maxLineWidth: z
    .number()
    .int()
    .min(24)
    .max(120)
    .default(72)
    .describe("Largura maxima alvo para cada linha."),
});

export interface TwilioTableFormatOutput {
  text: string;
  lineCount: number;
  truncatedCells: number;
}

export type TwilioTableFormatToolDefinition = ReturnType<
  typeof tool<z.infer<typeof twilioTableFormatInputSchema>, TwilioTableFormatOutput>
>;

export interface TwilioTableFormatTool {
  tool: TwilioTableFormatToolDefinition;
}

export const NewTwilioTableFormatTool = (): TwilioTableFormatTool => {
  return {
    tool: tool({
      description:
        "Monta uma tabela textual compacta para envio em mensagens Twilio/WhatsApp. Use quando precisar listar itens, precos, quantidades ou resumos em colunas legiveis dentro de um body de texto.",
      inputSchema: twilioTableFormatInputSchema,
      execute: async (input): Promise<TwilioTableFormatOutput> => {
        const widths = computeColumnWidths(input);
        let truncatedCells = 0;
        const separator = buildSeparator(widths);
        const lines: string[] = [];

        if (input.title) {
          lines.push(`*${input.title}*`);
        }

        lines.push(formatRow(input.columns.map((column) => column.label), widths));
        lines.push(separator);

        for (const row of input.rows) {
          const cells = input.columns.map((column) => {
            const rawValue = row[column.key];

            return rawValue === null || rawValue === undefined
              ? ""
              : String(rawValue);
          });
          const formattedCells = cells.map((cell, index) => {
            const width = widths[index]!;
            const normalizedCell = normalizeCellValue(cell);
            const truncatedCell = truncateCell(normalizedCell, width);

            if (truncatedCell !== normalizedCell) {
              truncatedCells += 1;
            }

            return alignCell(
              truncatedCell,
              width,
              input.columns[index]!.align ?? "left",
            );
          });

          lines.push(`| ${formattedCells.join(" | ")} |`);
        }

        if (input.footer.length > 0) {
          lines.push(separator);
          lines.push(...input.footer);
        }

        return {
          text: lines.join("\n"),
          lineCount: lines.length,
          truncatedCells,
        };
      },
    }),
  };
};

const computeColumnWidths = (
  input: z.infer<typeof twilioTableFormatInputSchema>,
): number[] => {
  const maxContentWidths = input.columns.map((column) => {
    const labelWidth = column.label.length;
    const rowWidth = Math.max(
      0,
      ...input.rows.map((row) => {
        const rawValue = row[column.key];

        return normalizeCellValue(
          rawValue === null || rawValue === undefined ? "" : String(rawValue),
        ).length;
      }),
    );

    return Math.max(labelWidth, rowWidth, 3);
  });
  const widths = input.columns.map((column, index) =>
    Math.min(maxContentWidths[index]!, column.maxWidth ?? maxContentWidths[index]!),
  );
  const totalWidth = computeRenderedWidth(widths);

  if (totalWidth <= input.maxLineWidth) {
    return widths;
  }

  const minimumWidths = input.columns.map(() => 3);
  let overflow = totalWidth - input.maxLineWidth;

  while (overflow > 0) {
    let reducedAny = false;

    for (let index = 0; index < widths.length && overflow > 0; index += 1) {
      if (widths[index]! > minimumWidths[index]!) {
        widths[index] = widths[index]! - 1;
        overflow -= 1;
        reducedAny = true;
      }
    }

    if (!reducedAny) {
      break;
    }
  }

  return widths;
};

const computeRenderedWidth = (widths: number[]): number => {
  return widths.reduce((sum, width) => sum + width, 0) + widths.length * 3 + 1;
};

const buildSeparator = (widths: number[]): string => {
  return `|-${widths.map((width) => "-".repeat(width)).join("-|-")}-|`;
};

const formatRow = (values: string[], widths: number[]): string => {
  return `| ${values
    .map((value, index) => alignCell(truncateCell(value, widths[index]!), widths[index]!, "left"))
    .join(" | ")} |`;
};

const normalizeCellValue = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const truncateCell = (value: string, width: number): string => {
  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  if (width <= 3) {
    return ".".repeat(width);
  }

  return `${value.slice(0, width - 3)}...`;
};

const alignCell = (
  value: string,
  width: number,
  align: "left" | "right",
): string => {
  const trimmedValue = value.length > width ? value.slice(0, width) : value;

  return align === "right"
    ? trimmedValue.padStart(width, " ")
    : trimmedValue.padEnd(width, " ");
};
