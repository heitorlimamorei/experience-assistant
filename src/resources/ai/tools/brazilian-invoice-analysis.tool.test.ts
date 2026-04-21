import { describe, expect, it } from "bun:test";

import {
  brazilianInvoiceAnalysisInputSchema,
  type BrazilianInvoiceAnalysisOutput,
  NewBrazilianInvoiceAnalysisTool,
} from "./brazilian-invoice-analysis.tool";

const executeBrazilianInvoiceTool = async (
  input: unknown,
): Promise<BrazilianInvoiceAnalysisOutput> => {
  const parsedInput = brazilianInvoiceAnalysisInputSchema.parse(input);
  const output = await NewBrazilianInvoiceAnalysisTool().tool.execute!(
    parsedInput,
    {
      toolCallId: "tool-call-test",
      messages: [],
    },
  );

  return output as BrazilianInvoiceAnalysisOutput;
};

describe("brazilian invoice analysis tool", () => {
  it("validates invoice identifiers and totals", async () => {
    const output = await executeBrazilianInvoiceTool({
      documentType: "nfe",
      sourceFormat: "pdf",
      issuer: {
        name: "ACME COMERCIO LTDA",
        document: "11.222.333/0001-81",
      },
      recipient: {
        name: "HEITOR MOREIRA",
        document: "529.982.247-25",
      },
      invoice: {
        number: "12345",
        series: "1",
        accessKey: "35251211222333000181550010000123451000123456",
        issueDate: "26/12/2025",
        operationNature: "Venda de mercadoria",
        paymentMethod: "PIX",
      },
      totals: {
        products: "150,00",
        freight: "10,00",
        discount: "5,00",
        invoiceTotal: "155,00",
      },
      items: [
        {
          description: "Produto A",
          quantity: 1,
          unitPrice: "100,00",
          totalPrice: "100,00",
        },
        {
          description: "Produto B",
          quantity: 1,
          unitPrice: "50,00",
          totalPrice: "50,00",
        },
      ],
      notes: ["DANFE emitido em ambiente de homologacao."],
    });

    expect(output).toBeDefined();
    expect(output.normalized.issuerDocument).toBe("11222333000181");
    expect(output.normalized.recipientDocument).toBe("52998224725");
    expect(output.normalized.issueDate).toBe("2025-12-26");
    expect(output.totals.calculatedInvoiceTotal).toBe(155);
    expect(output.totals.differenceFromDeclaredTotal).toBe(0);
    expect(output.checks.find((check) => check.name === "access_key")?.status).toBe(
      "ok",
    );
    expect(
      output.checks.find((check) => check.name === "invoice_total")?.status,
    ).toBe("ok");
  });

  it("flags invalid identifiers and mismatched totals", async () => {
    const output = await executeBrazilianInvoiceTool({
      documentType: "nfe",
      sourceFormat: "image",
      issuer: {
        name: "Empresa X",
        document: "11.111.111/1111-11",
      },
      invoice: {
        number: "999",
        accessKey: "123",
        issueDate: "dezembro/2025",
      },
      totals: {
        products: 100,
        invoiceTotal: 70,
      },
      items: [
        {
          description: "Servico ou produto",
          totalPrice: 80,
        },
      ],
      notes: [],
    });

    expect(output).toBeDefined();
    expect(output.checks.find((check) => check.name === "issuer_document")?.status).toBe(
      "error",
    );
    expect(output.checks.find((check) => check.name === "access_key")?.status).toBe(
      "error",
    );
    expect(output.checks.find((check) => check.name === "invoice_total")?.status).toBe(
      "warning",
    );
    expect(output.recommendation).toContain("inconsistencias");
  });
});
