/**
 * client/src/lib/receipt.ts
 *
 * Fonte única de verdade para o comprovante de pagamento enviado ao cliente
 * (WhatsApp e PDF). Antes esse texto era montado só dentro de Pedidos.tsx —
 * qualquer outra tela que confirmasse um pedido (ex.: Nova Venda) não tinha
 * como mostrar/enviar o mesmo comprovante. Centralizando aqui, qualquer tela
 * pode reaproveitar o mesmo formato, incluindo o detalhamento de parcelas
 * quando o pagamento é por boleto.
 */
import { PAYMENT_LABEL } from "@/lib/orderStatus";

export type ReceiptOrderInput = {
  id: number;
  buyerName: string;
  buyerContact: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  confirmedAt?: string | Date | null;
  adminNotes?: string | null;
};

export type ReceiptInstallment = {
  installmentNumber: number;
  amount: number;
  dueDate: string | Date;
};

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export function normalizePhone(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function buildWhatsAppUrl(message: string, contact: string): string {
  const text = encodeURIComponent(message);
  const phone = normalizePhone(contact);
  return phone.length >= 10
    ? `https://wa.me/55${phone.startsWith("55") ? phone.slice(2) : phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

/**
 * Monta o texto do comprovante enviado via WhatsApp. Quando `installments`
 * é informado (pedido em boleto com notas promissórias geradas), inclui o
 * detalhamento de cada parcela — número de parcelas, valor e vencimento —
 * exatamente como pedido: "quando for boleto, a quantidade de parcelas, o
 * valor, e as informações que vão ser enviadas pelo comprovante".
 */
export function buildReceiptMessage(
  order: ReceiptOrderInput,
  installments?: ReceiptInstallment[] | null,
  documentsUrl?: string | null
): string {
  const lines = [
    "✅ *COMPROVANTE DE PAGAMENTO CONFIRMADO*",
    "*Shoop PermuPay*",
    "",
    `*Pedido:* #${order.id}`,
    `*Cliente:* ${order.buyerName}`,
    `*Contato:* ${order.buyerContact}`,
    `*Produto:* ${order.productName}`,
    `*Quantidade:* ${order.quantity}`,
    `*Valor unitário:* ${fmt(order.unitPrice)}`,
    `*Valor total:* ${fmt(order.totalPrice)}`,
    `*Pagamento:* ${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}`,
  ];

  if (installments?.length) {
    lines.push(`*Parcelamento:* ${installments.length}x`);
    for (const inst of installments) {
      lines.push(
        `   • Parcela ${inst.installmentNumber}/${installments.length} — ${fmt(inst.amount)} — vence em ${formatDate(inst.dueDate)}`
      );
    }
    lines.push(
      "_As notas promissórias de cada parcela foram geradas e ficam disponíveis no seu cadastro. Assine e devolva as notas para liberarmos o envio dos boletos de pagamento._"
    );
  }

  lines.push(
    `*Confirmado em:* ${formatDateTime(order.confirmedAt)}`,
    "*Status:* Pagamento confirmado e pedido liberado para retirada."
  );

  if (documentsUrl) {
    lines.push(
      "",
      `📄 *Baixe seu comprovante e suas notas promissórias:* ${documentsUrl}`
    );
  }

  lines.push(
    "",
    "Se precisar, responda esta mensagem para receber atendimento.",
    "Shoop PermuPay — atendimento e confirmação oficial."
  );

  if (order.adminNotes) {
    const noteIndex = lines.length - 2;
    lines.splice(noteIndex, 0, `*Observação:* ${order.adminNotes}`);
  }

  return lines.join("\n");
}

/** Remove marcação usada no texto do WhatsApp (*negrito*, _itálico_) para um corpo de e-mail em texto puro. */
function stripWhatsAppMarkup(message: string): string {
  return message.replace(/\*(.+?)\*/g, "$1").replace(/_(.+?)_/g, "$1");
}

/**
 * Monta um link `mailto:` para o admin enviar o comprovante por e-mail
 * diretamente do próprio cliente de e-mail (abre o app/webmail padrão já
 * com destinatário, assunto e corpo preenchidos). O sistema não tem um
 * servidor de e-mail transacional configurado — este é o mesmo padrão já
 * usado para o WhatsApp (link que abre o app do usuário), aplicado ao
 * e-mail.
 */
export function buildMailtoUrl(
  message: string,
  opts: { to?: string; subject: string }
): string {
  // encodeURIComponent (não URLSearchParams) para não trocar espaços por
  // "+" — alguns clientes de e-mail exibem o "+" literalmente no corpo.
  const subject = encodeURIComponent(opts.subject);
  const body = encodeURIComponent(stripWhatsAppMarkup(message));
  const to = opts.to?.includes("@") ? encodeURIComponent(opts.to.trim()) : "";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

/** Converte um PDF em base64 (retornado pelo backend) num download no navegador. */
export function downloadBase64Pdf(base64: string, filename: string): void {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
