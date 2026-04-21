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
        "Monta um layout textual compativel com mensagens Twilio/WhatsApp usando apenas plain text, negrito simples e quebras de linha. Use quando precisar listar itens, entradas, saidas, precos, quantidades ou resumos sem depender de tabelas ASCII.",
      inputSchema: twilioTableFormatInputSchema,
      execute: async (input): Promise<TwilioTableFormatOutput> => {
        let truncatedCells = 0;
        const lines: string[] = [];

        if (input.title) {
          lines.push(`*${input.title}*`);
        }

        for (const row of input.rows) {
          const formattedRow = formatRowForTwilio({
            columns: input.columns,
            row,
            maxLineWidth: input.maxLineWidth,
          });

          truncatedCells += formattedRow.truncatedCells;
          lines.push(...formattedRow.lines);
        }

        if (input.footer.length > 0) {
          if (lines.length > 0) {
            lines.push("");
          }

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

const formatRowForTwilio = ({
  columns,
  row,
  maxLineWidth,
}: {
  columns: z.infer<typeof twilioTableColumnSchema>[];
  row: z.infer<typeof twilioTableRowSchema>;
  maxLineWidth: number;
}): {
  lines: string[];
  truncatedCells: number;
} => {
  const normalizedCells = columns.map((column) => {
    const rawValue = row[column.key];

    return {
      label: normalizeCellValue(column.label),
      value: normalizeCellValue(
        rawValue === null || rawValue === undefined ? "" : String(rawValue),
      ),
      maxWidth: column.maxWidth,
    };
  });
  let truncatedCells = 0;

  if (
    normalizedCells.length === 2 &&
    isPrimaryLabelColumn(columns[0]!.label)
  ) {
    const primaryLabel = truncateCell(
      normalizedCells[0]!.value,
      columns[0]!.maxWidth ?? 48,
    );
    const secondaryValue = truncateCellToLine(
      normalizedCells[1]!.value,
      maxLineWidth - primaryLabel.length - 6,
      columns[1]!.maxWidth,
    );

    if (primaryLabel !== normalizedCells[0]!.value) {
      truncatedCells += 1;
    }

    if (secondaryValue !== normalizedCells[1]!.value) {
      truncatedCells += 1;
    }

    return {
      lines: [`• *${primaryLabel}:* ${secondaryValue}`],
      truncatedCells,
    };
  }

  const firstCell = normalizedCells[0]!;
  const firstValue = truncateCellToLine(
    firstCell.value,
    maxLineWidth - 4,
    columns[0]!.maxWidth,
  );

  if (firstValue !== firstCell.value) {
    truncatedCells += 1;
  }

  const lines = [`• *${firstCell.label}:* ${firstValue}`];

  for (let index = 1; index < normalizedCells.length; index += 1) {
    const cell = normalizedCells[index]!;
    const value = truncateCellToLine(
      cell.value,
      maxLineWidth - cell.label.length - 5,
      columns[index]!.maxWidth,
    );

    if (value !== cell.value) {
      truncatedCells += 1;
    }

    lines.push(`  *${cell.label}:* ${value}`);
  }

  return {
    lines,
    truncatedCells,
  };
};

const isPrimaryLabelColumn = (label: string): boolean => {
  const normalizedLabel = normalizeCellValue(label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return [
    "descricao",
    "description",
    "item",
    "campo",
    "label",
    "entrada",
    "saida",
  ].includes(normalizedLabel);
};

const normalizeCellValue = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const truncateCell = (value: string, width: number): string => {
  if (value.length <= width) {
    return value;
  }

  if (width <= 3) {
    return ".".repeat(width);
  }

  return `${value.slice(0, width - 3)}...`;
};

const truncateCellToLine = (
  value: string,
  width: number,
  maxWidth?: number,
): string => {
  const safeWidth = Math.max(3, width);
  const targetWidth = maxWidth
    ? Math.min(maxWidth, safeWidth)
    : safeWidth;

  return truncateCell(value, targetWidth);
};
