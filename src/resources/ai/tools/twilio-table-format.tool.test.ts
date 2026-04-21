import { describe, expect, it } from "bun:test";

import {
  NewTwilioTableFormatTool,
  twilioTableFormatInputSchema,
  type TwilioTableFormatOutput,
} from "./twilio-table-format.tool";

const executeTwilioTableTool = async (
  input: unknown,
): Promise<TwilioTableFormatOutput> => {
  const parsedInput = twilioTableFormatInputSchema.parse(input);

  return (await NewTwilioTableFormatTool().tool.execute!(parsedInput, {
    toolCallId: "tool-call-test",
    messages: [],
  })) as TwilioTableFormatOutput;
};

describe("twilio table format tool", () => {
  it("formats a compact text table for Twilio messages", async () => {
    const output = await executeTwilioTableTool({
      title: "Itens da nota",
      columns: [
        { key: "item", label: "Item", maxWidth: 18 },
        { key: "qty", label: "Qtd", align: "right", maxWidth: 5 },
        { key: "total", label: "Total", align: "right", maxWidth: 10 },
      ],
      rows: [
        { item: "Cafe especial 250g", qty: 2, total: "R$ 35,00" },
        { item: "Bolo de cenoura", qty: 1, total: "R$ 18,90" },
      ],
      footer: ["Total geral: R$ 53,90"],
      maxLineWidth: 52,
    });

    expect(output.text).toContain("*Itens da nota*");
    expect(output.text).toContain("| Item");
    expect(output.text).toContain("Cafe especial");
    expect(output.text).toContain("R$ 53,90");
    expect(output.lineCount).toBeGreaterThan(4);
    expect(output.truncatedCells).toBeGreaterThanOrEqual(0);
  });

  it("truncates cells when the line width is too small", async () => {
    const output = await executeTwilioTableTool({
      columns: [
        { key: "description", label: "Descricao", maxWidth: 20 },
        { key: "value", label: "Valor", align: "right", maxWidth: 12 },
      ],
      rows: [
        {
          description: "Produto com nome extremamente longo para o limite",
          value: "R$ 1234,56",
        },
      ],
      maxLineWidth: 28,
    });

    expect(output.truncatedCells).toBeGreaterThan(0);
    expect(output.text).toContain("...");
  });
});
