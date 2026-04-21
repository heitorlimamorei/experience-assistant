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
  it("formats a Twilio-friendly list for key-value rows", async () => {
    const output = await executeTwilioTableTool({
      title: "Entradas de valores",
      columns: [
        { key: "description", label: "Descricao", maxWidth: 24 },
        { key: "value", label: "Valor", maxWidth: 14 },
      ],
      rows: [
        { description: "Valor do servico", value: "R$ 4.099,99" },
        { description: "IRRF, CP, CSLL retidos", value: "R$ 0,00" },
        { description: "Valor liquido", value: "R$ 4.099,99" },
      ],
      footer: ["*Total da NFS-e:* R$ 4.099,99"],
      maxLineWidth: 52,
    });

    expect(output.text).toContain("*Entradas de valores*");
    expect(output.text).toContain("• *Valor do servico:* R$ 4.099,99");
    expect(output.text).toContain("• *IRRF, CP, CSLL retidos:* R$ 0,00");
    expect(output.text).toContain("*Total da NFS-e:* R$ 4.099,99");
    expect(output.lineCount).toBeGreaterThan(4);
    expect(output.truncatedCells).toBeGreaterThanOrEqual(0);
  });

  it("falls back to multiline rows when there are more than two columns", async () => {
    const output = await executeTwilioTableTool({
      columns: [
        { key: "item", label: "Item", maxWidth: 18 },
        { key: "qty", label: "Qtd", maxWidth: 6 },
        { key: "total", label: "Total", maxWidth: 12 },
      ],
      rows: [
        {
          item: "Produto com nome extremamente longo para o limite",
          qty: 2,
          total: "R$ 1234,56",
        },
      ],
      maxLineWidth: 34,
    });

    expect(output.text).toContain("• *Item:*");
    expect(output.text).toContain("*Qtd:* 2");
    expect(output.text).toContain("*Total:* R$ 1234,56");
    expect(output.truncatedCells).toBeGreaterThan(0);
    expect(output.text).toContain("...");
  });
});
