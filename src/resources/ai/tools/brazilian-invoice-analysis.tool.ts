import { tool } from "ai";
import { z } from "zod";

const optionalTrimmedStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().optional());

const optionalNumberSchema = z.preprocess((value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = trimmedValue
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : value;
}, z.number().optional());

const invoicePartySchema = z.object({
  name: optionalTrimmedStringSchema.describe("Nome da empresa ou pessoa."),
  document: optionalTrimmedStringSchema.describe(
    "CPF ou CNPJ do participante, se identificado.",
  ),
  stateRegistration: optionalTrimmedStringSchema.describe(
    "Inscricao estadual, se houver.",
  ),
});

const invoiceTotalsSchema = z.object({
  products: optionalNumberSchema.describe(
    "Soma dos produtos da nota, sem descontos.",
  ),
  services: optionalNumberSchema.describe(
    "Soma dos servicos, quando a nota tiver servicos.",
  ),
  discount: optionalNumberSchema.describe("Desconto total da nota."),
  freight: optionalNumberSchema.describe("Frete total."),
  insurance: optionalNumberSchema.describe("Seguro total."),
  otherCharges: optionalNumberSchema.describe("Outras despesas acessorias."),
  invoiceTotal: optionalNumberSchema.describe("Valor total da nota."),
});

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).describe("Descricao do item."),
  quantity: optionalNumberSchema.describe("Quantidade do item."),
  unitPrice: optionalNumberSchema.describe("Valor unitario do item."),
  totalPrice: optionalNumberSchema.describe("Valor total do item."),
  ncm: optionalTrimmedStringSchema.describe("Codigo NCM, se legivel."),
  cfop: optionalTrimmedStringSchema.describe("Codigo CFOP, se legivel."),
});

export const brazilianInvoiceAnalysisInputSchema = z.object({
  documentType: z
    .enum(["nfe", "nfce", "nfse", "cte", "mdfe", "unknown"])
    .default("unknown")
    .describe("Tipo de documento fiscal identificado pelo modelo."),
  sourceFormat: z
    .enum(["image", "pdf", "text", "unknown"])
    .default("unknown")
    .describe("Formato de origem analisado pelo modelo."),
  issuer: invoicePartySchema.describe("Emitente da nota."),
  recipient: invoicePartySchema
    .optional()
    .describe("Destinatario ou tomador do documento."),
  invoice: z
    .object({
      number: optionalTrimmedStringSchema.describe("Numero da nota."),
      series: optionalTrimmedStringSchema.describe("Serie da nota."),
      accessKey: optionalTrimmedStringSchema.describe(
        "Chave de acesso da NFe/NFCe, se disponivel.",
      ),
      issueDate: optionalTrimmedStringSchema.describe(
        "Data de emissao no formato encontrado no documento.",
      ),
      operationNature: optionalTrimmedStringSchema.describe(
        "Natureza da operacao ou descricao similar.",
      ),
      paymentMethod: optionalTrimmedStringSchema.describe(
        "Forma de pagamento, se legivel.",
      ),
    })
    .describe("Metadados gerais do documento."),
  totals: invoiceTotalsSchema.describe("Totais financeiros do documento."),
  items: z
    .array(invoiceItemSchema)
    .default([])
    .describe("Itens detectados no documento."),
  notes: z
    .array(z.string().trim().min(1))
    .default([])
    .describe("Observacoes livres extraidas do documento."),
});

export type BrazilianInvoiceAnalysisInput = z.infer<
  typeof brazilianInvoiceAnalysisInputSchema
>;

export interface BrazilianInvoiceAnalysisOutput {
  documentType: BrazilianInvoiceAnalysisInput["documentType"];
  sourceFormat: BrazilianInvoiceAnalysisInput["sourceFormat"];
  normalized: {
    issuerDocument?: string;
    issuerDocumentType?: "cpf" | "cnpj" | "unknown";
    recipientDocument?: string;
    recipientDocumentType?: "cpf" | "cnpj" | "unknown";
    accessKey?: string;
    issueDate?: string;
  };
  totals: {
    declaredInvoiceTotal?: number;
    calculatedInvoiceTotal?: number;
    itemTotalsSum?: number;
    differenceFromDeclaredTotal?: number;
  };
  checks: Array<{
    name: string;
    status: "ok" | "warning" | "error";
    details: string;
  }>;
  summary: {
    issuerName?: string;
    recipientName?: string;
    invoiceNumber?: string;
    series?: string;
    itemCount: number;
    paymentMethod?: string;
    operationNature?: string;
  };
  recommendation: string;
}

export type BrazilianInvoiceAnalysisToolDefinition = ReturnType<
  typeof tool<BrazilianInvoiceAnalysisInput, BrazilianInvoiceAnalysisOutput>
>;

export interface BrazilianInvoiceAnalysisTool {
  tool: BrazilianInvoiceAnalysisToolDefinition;
}

export const NewBrazilianInvoiceAnalysisTool =
  (): BrazilianInvoiceAnalysisTool => {
    return {
      tool: tool({
        description:
          "Analisa detalhes de documentos fiscais brasileiros, como NFe, NFC-e e NFS-e. Use apos ler uma nota fiscal em imagem, PDF ou texto para validar chave de acesso, CPF/CNPJ, coerencia dos totais e gerar um resumo estruturado.",
        inputSchema: brazilianInvoiceAnalysisInputSchema,
        execute: async (
          input: BrazilianInvoiceAnalysisInput,
        ): Promise<BrazilianInvoiceAnalysisOutput> => {
          const checks: BrazilianInvoiceAnalysisOutput["checks"] = [];
          const issuerDocument = normalizeDigits(input.issuer.document);
          const recipientDocument = normalizeDigits(input.recipient?.document);
          const issuerDocumentType = detectBrazilianDocumentType(issuerDocument);
          const recipientDocumentType =
            detectBrazilianDocumentType(recipientDocument);
          const normalizedAccessKey = normalizeDigits(input.invoice.accessKey);
          const normalizedIssueDate = normalizeBrazilianDate(input.invoice.issueDate);
          const itemTotalsSum = roundCurrency(
            input.items.reduce((total, item) => {
              if (typeof item.totalPrice === "number") {
                return total + item.totalPrice;
              }

              if (
                typeof item.quantity === "number" &&
                typeof item.unitPrice === "number"
              ) {
                return total + item.quantity * item.unitPrice;
              }

              return total;
            }, 0),
          );
          const calculatedInvoiceTotal = buildCalculatedInvoiceTotal(input.totals);
          const differenceFromDeclaredTotal =
            typeof input.totals.invoiceTotal === "number" &&
            typeof calculatedInvoiceTotal === "number"
              ? roundCurrency(calculatedInvoiceTotal - input.totals.invoiceTotal)
              : undefined;

          addDocumentCheck({
            label: "issuer_document",
            value: issuerDocument,
            detectedType: issuerDocumentType,
            checks,
          });
          addDocumentCheck({
            label: "recipient_document",
            value: recipientDocument,
            detectedType: recipientDocumentType,
            checks,
          });
          addAccessKeyCheck(normalizedAccessKey, checks);
          addIssueDateCheck(normalizedIssueDate, input.invoice.issueDate, checks);
          addItemTotalsCheck(itemTotalsSum, input.totals.products, checks);
          addInvoiceTotalCheck(
            calculatedInvoiceTotal,
            input.totals.invoiceTotal,
            differenceFromDeclaredTotal,
            checks,
          );
          addMissingFieldsCheck(input, checks);

          return {
            documentType: input.documentType,
            sourceFormat: input.sourceFormat,
            normalized: {
              issuerDocument,
              issuerDocumentType,
              recipientDocument,
              recipientDocumentType,
              accessKey: normalizedAccessKey,
              issueDate: normalizedIssueDate,
            },
            totals: {
              declaredInvoiceTotal: input.totals.invoiceTotal,
              calculatedInvoiceTotal,
              itemTotalsSum:
                itemTotalsSum > 0 || input.items.length > 0
                  ? itemTotalsSum
                  : undefined,
              differenceFromDeclaredTotal,
            },
            checks,
            summary: {
              issuerName: input.issuer.name,
              recipientName: input.recipient?.name,
              invoiceNumber: input.invoice.number,
              series: input.invoice.series,
              itemCount: input.items.length,
              paymentMethod: input.invoice.paymentMethod,
              operationNature: input.invoice.operationNature,
            },
            recommendation: buildRecommendation(checks),
          };
        },
      }),
    };
  };

const addDocumentCheck = ({
  label,
  value,
  detectedType,
  checks,
}: {
  label: string;
  value?: string;
  detectedType: "cpf" | "cnpj" | "unknown";
  checks: BrazilianInvoiceAnalysisOutput["checks"];
}) => {
  if (!value) {
    checks.push({
      name: label,
      status: "warning",
      details: "Documento nao informado.",
    });

    return;
  }

  if (detectedType === "cpf" && isValidCPF(value)) {
    checks.push({
      name: label,
      status: "ok",
      details: "CPF com formato e digitos verificadores validos.",
    });

    return;
  }

  if (detectedType === "cnpj" && isValidCNPJ(value)) {
    checks.push({
      name: label,
      status: "ok",
      details: "CNPJ com formato e digitos verificadores validos.",
    });

    return;
  }

  checks.push({
    name: label,
    status: "error",
    details: "Documento com formato invalido ou digitos verificadores inconsistentes.",
  });
};

const addAccessKeyCheck = (
  accessKey: string | undefined,
  checks: BrazilianInvoiceAnalysisOutput["checks"],
) => {
  if (!accessKey) {
    checks.push({
      name: "access_key",
      status: "warning",
      details: "Chave de acesso nao identificada.",
    });

    return;
  }

  if (isValidNFeAccessKey(accessKey)) {
    checks.push({
      name: "access_key",
      status: "ok",
      details: "Chave de acesso com 44 digitos e digito verificador consistente.",
    });

    return;
  }

  checks.push({
    name: "access_key",
    status: "error",
    details: "Chave de acesso invalida para NFe/NFC-e.",
  });
};

const addIssueDateCheck = (
  normalizedIssueDate: string | undefined,
  rawIssueDate: string | undefined,
  checks: BrazilianInvoiceAnalysisOutput["checks"],
) => {
  if (!rawIssueDate) {
    checks.push({
      name: "issue_date",
      status: "warning",
      details: "Data de emissao nao informada.",
    });

    return;
  }

  if (normalizedIssueDate) {
    checks.push({
      name: "issue_date",
      status: "ok",
      details: `Data de emissao normalizada para ${normalizedIssueDate}.`,
    });

    return;
  }

  checks.push({
    name: "issue_date",
    status: "warning",
    details: `Nao foi possivel normalizar a data de emissao: ${rawIssueDate}.`,
  });
};

const addItemTotalsCheck = (
  itemTotalsSum: number,
  declaredProductsTotal: number | undefined,
  checks: BrazilianInvoiceAnalysisOutput["checks"],
) => {
  if (typeof declaredProductsTotal !== "number") {
    checks.push({
      name: "items_vs_products_total",
      status: itemTotalsSum > 0 ? "warning" : "ok",
      details:
        itemTotalsSum > 0
          ? "Itens somados, mas total de produtos nao foi informado."
          : "Sem itens suficientes para comparar com o total de produtos.",
    });

    return;
  }

  if (itemTotalsSum === 0) {
    checks.push({
      name: "items_vs_products_total",
      status: "warning",
      details: "Total de produtos informado, mas os itens nao permitiram recalculo.",
    });

    return;
  }

  const difference = Math.abs(roundCurrency(itemTotalsSum - declaredProductsTotal));

  checks.push({
    name: "items_vs_products_total",
    status: difference <= 0.05 ? "ok" : "warning",
    details:
      difference <= 0.05
        ? "Soma dos itens consistente com o total de produtos."
        : `Soma dos itens difere do total de produtos em R$ ${difference.toFixed(2)}.`,
  });
};

const addInvoiceTotalCheck = (
  calculatedInvoiceTotal: number | undefined,
  declaredInvoiceTotal: number | undefined,
  differenceFromDeclaredTotal: number | undefined,
  checks: BrazilianInvoiceAnalysisOutput["checks"],
) => {
  if (
    typeof declaredInvoiceTotal !== "number" ||
    typeof calculatedInvoiceTotal !== "number" ||
    typeof differenceFromDeclaredTotal !== "number"
  ) {
    checks.push({
      name: "invoice_total",
      status: "warning",
      details:
        "Nao foi possivel comparar o total declarado com o total recomputado.",
    });

    return;
  }

  const absoluteDifference = Math.abs(differenceFromDeclaredTotal);

  checks.push({
    name: "invoice_total",
    status: absoluteDifference <= 0.05 ? "ok" : "warning",
    details:
      absoluteDifference <= 0.05
        ? "Total da nota consistente com os componentes financeiros informados."
        : `Total recomputado difere do declarado em R$ ${absoluteDifference.toFixed(2)}.`,
  });
};

const addMissingFieldsCheck = (
  input: BrazilianInvoiceAnalysisInput,
  checks: BrazilianInvoiceAnalysisOutput["checks"],
) => {
  const missingFields = [
    input.issuer.name ? undefined : "issuer.name",
    input.invoice.number ? undefined : "invoice.number",
    input.invoice.issueDate ? undefined : "invoice.issueDate",
    typeof input.totals.invoiceTotal === "number"
      ? undefined
      : "totals.invoiceTotal",
  ].filter((value): value is string => Boolean(value));

  if (missingFields.length === 0) {
    checks.push({
      name: "critical_fields",
      status: "ok",
      details: "Campos essenciais da nota foram identificados.",
    });

    return;
  }

  checks.push({
    name: "critical_fields",
    status: "warning",
    details: `Campos essenciais ausentes: ${missingFields.join(", ")}.`,
  });
};

const buildCalculatedInvoiceTotal = (
  totals: BrazilianInvoiceAnalysisInput["totals"],
): number | undefined => {
  const numericValues = [
    totals.products,
    totals.services,
    totals.freight,
    totals.insurance,
    totals.otherCharges,
    totals.discount,
  ].filter((value): value is number => typeof value === "number");

  if (numericValues.length === 0) {
    return undefined;
  }

  return roundCurrency(
    (totals.products || 0) +
      (totals.services || 0) +
      (totals.freight || 0) +
      (totals.insurance || 0) +
      (totals.otherCharges || 0) -
      (totals.discount || 0),
  );
};

const buildRecommendation = (
  checks: BrazilianInvoiceAnalysisOutput["checks"],
): string => {
  if (checks.some((check) => check.status === "error")) {
    return "Ha inconsistencias fortes. Revise os documentos fiscais e confirme os campos extraidos antes de seguir.";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "A analise encontrou pendencias ou campos incompletos. Vale revisar os pontos sinalizados.";
  }

  return "Os campos analisados estao consistentes com a validacao automatica disponivel.";
};

const normalizeDigits = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const digitsOnly = value.replace(/\D/g, "");

  return digitsOnly || undefined;
};

const detectBrazilianDocumentType = (
  value?: string,
): "cpf" | "cnpj" | "unknown" => {
  if (!value) {
    return "unknown";
  }

  if (value.length === 11) {
    return "cpf";
  }

  if (value.length === 14) {
    return "cnpj";
  }

  return "unknown";
};

const isValidCPF = (value: string): boolean => {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const firstVerifier = calculateCPFVerifier(digits.slice(0, 9), 10);
  const secondVerifier = calculateCPFVerifier(digits.slice(0, 10), 11);

  return firstVerifier === digits[9] && secondVerifier === digits[10];
};

const calculateCPFVerifier = (digits: number[], factor: number): number => {
  const total = digits.reduce((sum, digit, index) => {
    return sum + digit * (factor - index);
  }, 0);
  const remainder = (total * 10) % 11;

  return remainder === 10 ? 0 : remainder;
};

const isValidCNPJ = (value: string): boolean => {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const firstVerifier = calculateCNPJVerifier(digits.slice(0, 12));
  const secondVerifier = calculateCNPJVerifier(digits.slice(0, 12).concat(firstVerifier));

  return firstVerifier === digits[12] && secondVerifier === digits[13];
};

const calculateCNPJVerifier = (digits: number[]): number => {
  const factors =
    digits.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const total = digits.reduce((sum, digit, index) => {
    return sum + digit * factors[index]!;
  }, 0);
  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
};

const isValidNFeAccessKey = (value: string): boolean => {
  if (!/^\d{44}$/.test(value) || /^(\d)\1{43}$/.test(value)) {
    return false;
  }

  const digits = value.split("").map(Number);
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let weightIndex = 0;
  let total = 0;

  for (let index = digits.length - 2; index >= 0; index -= 1) {
    total += digits[index]! * weights[weightIndex]!;
    weightIndex = (weightIndex + 1) % weights.length;
  }

  const remainder = total % 11;
  const expectedVerifier = remainder < 2 ? 0 : 11 - remainder;

  return expectedVerifier === digits[43];
};

const normalizeBrazilianDate = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  const isoDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }

  const brazilianDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!brazilianDateMatch) {
    return undefined;
  }

  return `${brazilianDateMatch[3]}-${brazilianDateMatch[2]}-${brazilianDateMatch[1]}`;
};

const roundCurrency = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};
