/**
 * client/src/components/BuyModal.tsx
 *
 * ALTERAÇÕES:
 * 1. Remove CTAs "Pagar com Pix" e "Confirmar Reserva"
 * 2. Única CTA: "Ir para o pagamento"
 * 3. Dados do produto pré-carregados automaticamente (nome, preço)
 * 4. Select para adicionar outro produto ao pedido
 * 5. Pedido salvo imediatamente ao clicar (status AGUARDANDO_PAGAMENTO)
 * 6. Sucesso mostra mensagem "Pagamento Confirmado / Liberado para Retirada"
 * 7. Segurança: não envia unitPrice para o backend; o servidor calcula o preço real
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  X,
  CheckCircle,
  ShoppingBag,
  Zap,
  CreditCard,
  FileText,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type PaymentMethod = "PIX" | "CARTAO" | "BOLETO";

interface ProductInfo {
  id: number;
  name: string;
  suggestedPricePix: number;
  suggestedPriceCard: number;
  suggestedPriceBoleto: number;
  suggestedPrice: number;
  cardInstallments?: number | null;
  boletoMonths?: number | null;
}

interface BuyModalProps {
  product: ProductInfo;
  /** Nome e contato pré-preenchidos se o usuário estiver logado */
  prefillName?: string;
  prefillContact?: string;
  onClose: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function resolvePrice(
  specific: number | null | undefined,
  fallback: number | null | undefined
): number {
  return (specific ?? 0) > 0 ? (specific as number) : (fallback ?? 0);
}

export function BuyModal({
  product: p,
  prefillName = "",
  prefillContact = "",
  onClose,
}: BuyModalProps) {
  const [step, setStep] = useState<"method" | "form" | "success">("method");
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [name, setName] = useState(prefillName);
  const [contact, setContact] = useState(prefillContact);
  const [contactType, setContactType] = useState<"WHATSAPP" | "EMAIL">(
    "WHATSAPP"
  );
  const [orderId, setOrderId] = useState<number | null>(null);

  // Produto adicional
  const [extraProductId, setExtraProductId] = useState<number | "">("");
  const allProducts = trpc.marketplace.products.useQuery(undefined, {
    staleTime: 60_000,
  });

  const pixPrice = resolvePrice(p.suggestedPricePix, p.suggestedPrice);
  const cardPrice = resolvePrice(p.suggestedPriceCard, p.suggestedPrice);
  const boletoPrice = resolvePrice(p.suggestedPriceBoleto, p.suggestedPrice);
  const inst = Math.max(1, Math.round(p.cardInstallments ?? 1));
  const boletoMonths = Math.max(1, Math.round(p.boletoMonths ?? 1));

  const priceByMethod: Record<PaymentMethod, number> = {
    PIX: pixPrice,
    CARTAO: cardPrice,
    BOLETO: boletoPrice,
  };

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      setOrderId(data.id);
      setStep("success");
    },
    onError: (e) => toast.error(e.message),
  });

  // Produto extra selecionado
  const extraProduct = allProducts.data?.find(
    (pr) => pr.id === extraProductId
  );
  const createExtraOrder = trpc.orders.create.useMutation({
    onError: (e) => console.warn("Pedido extra falhou:", e.message),
  });

  const handleGoToPayment = () => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!contact.trim()) return toast.error("Informe seu WhatsApp ou email");

    // Criar pedido principal
    // Segurança: o preço NÃO é enviado pelo navegador.
    // O backend calcula o valor correto pelo produto e forma de pagamento.
    createOrder.mutate(
      {
        productId: p.id,
        quantity: 1,
        buyerName: name.trim(),
        buyerContact: contact.trim(),
        buyerContactType: contactType,
        paymentMethod: method,
      },
      {
        onSuccess: () => {
          // Se houver produto extra, criar pedido adicional
          if (extraProductId && extraProduct) {
            createExtraOrder.mutate({
              productId: extraProduct.id,
              quantity: 1,
              buyerName: name.trim(),
              buyerContact: contact.trim(),
              buyerContactType: contactType,
              paymentMethod: method,
            });
          }
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900 text-base">
            {step === "success"
              ? "Pedido Registrado!"
              : `Comprar — ${p.name}`}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step: escolha do método ─────────────────────────────────────── */}
        {step === "method" && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-neutral-500">
              Escolha a forma de pagamento:
            </p>

            <div className="space-y-2">
              {/* PIX */}
              {pixPrice > 0 && (
                <button
                  onClick={() => setMethod("PIX")}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                    method === "PIX"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Zap
                      className={`w-5 h-5 ${
                        method === "PIX"
                          ? "text-emerald-600"
                          : "text-neutral-400"
                      }`}
                    />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-neutral-900">
                        PIX / À Vista
                      </p>
                      <p className="text-xs text-neutral-500">
                        Pagamento instantâneo
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-neutral-900">
                    {fmt(pixPrice)}
                  </span>
                </button>
              )}

              {/* Cartão */}
              {cardPrice > 0 && (
                <button
                  onClick={() => setMethod("CARTAO")}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                    method === "CARTAO"
                      ? "border-blue-500 bg-blue-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard
                      className={`w-5 h-5 ${
                        method === "CARTAO"
                          ? "text-blue-600"
                          : "text-neutral-400"
                      }`}
                    />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-neutral-900">
                        Cartão de Crédito
                      </p>
                      {inst > 1 && (
                        <p className="text-xs text-neutral-500">
                          {inst}x de {fmt(cardPrice / inst)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-base font-bold text-neutral-900">
                    {fmt(cardPrice)}
                  </span>
                </button>
              )}

              {/* Boleto */}
              {boletoPrice > 0 && (
                <button
                  onClick={() => setMethod("BOLETO")}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                    method === "BOLETO"
                      ? "border-orange-500 bg-orange-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText
                      className={`w-5 h-5 ${
                        method === "BOLETO"
                          ? "text-orange-600"
                          : "text-neutral-400"
                      }`}
                    />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-neutral-900">
                        Boleto Parcelado
                      </p>
                      {boletoMonths > 1 && (
                        <p className="text-xs text-neutral-500">
                          {boletoMonths}x de {fmt(boletoPrice / boletoMonths)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-base font-bold text-neutral-900">
                    {fmt(boletoPrice)}
                  </span>
                </button>
              )}
            </div>

            <Button className="w-full mt-2" onClick={() => setStep("form")}>
              Continuar
            </Button>
          </div>
        )}

        {/* ── Step: dados do comprador ────────────────────────────────────── */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-4">
            {/* Resumo do método */}
            <div className="flex items-center justify-between text-sm bg-neutral-50 rounded-lg px-3 py-2">
              <span className="text-neutral-500">
                {p.name}
              </span>
              <span className="font-bold text-neutral-900">
                {method === "PIX"
                  ? "PIX"
                  : method === "CARTAO"
                  ? "Cartão"
                  : "Boleto"}{" "}
                — {fmt(priceByMethod[method])}
              </span>
            </div>

            <div className="space-y-3">
              {/* Nome — pré-preenchido se disponível */}
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">
                  Seu nome *
                </label>
                <Input
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Contato — pré-preenchido se disponível */}
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">
                  Contato *
                </label>
                <div className="flex gap-2">
                  <select
                    value={contactType}
                    onChange={(e) =>
                      setContactType(e.target.value as "WHATSAPP" | "EMAIL")
                    }
                    className="border border-input rounded-md px-2 py-2 text-sm bg-background"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                  <Input
                    placeholder={
                      contactType === "WHATSAPP"
                        ? "(11) 99999-9999"
                        : "seu@email.com"
                    }
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Adicionar outro produto */}
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-neutral-400" />
                  Adicionar outro produto (opcional)
                </label>
                <select
                  value={extraProductId}
                  onChange={(e) =>
                    setExtraProductId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">— Selecione um produto —</option>
                  {allProducts.data
                    ?.filter((pr) => pr.id !== p.id)
                    .map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                        {pr.suggestedPrice
                          ? ` — ${fmt(pr.suggestedPrice)}`
                          : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep("method")}
                className="flex-1"
              >
                Voltar
              </Button>
              {/* ÚNICA CTA: "Ir para o pagamento" */}
              <Button
                onClick={handleGoToPayment}
                disabled={createOrder.isPending}
                className="flex-1 bg-stone-900 hover:bg-stone-700 text-white font-semibold"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                {createOrder.isPending
                  ? "Registrando..."
                  : "Ir para o pagamento"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: sucesso ───────────────────────────────────────────────── */}
        {step === "success" && (
          <div className="px-6 py-8 text-center space-y-4">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <div>
              <h3 className="font-bold text-neutral-900 text-lg">
                Pedido #{orderId} registrado!
              </h3>
              <p className="text-sm text-neutral-500 mt-1">
                Seu pedido está salvo e já aparece no painel. Efetue o
                pagamento e aguarde a confirmação da nossa equipe.
              </p>
            </div>

            <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3 text-left space-y-1.5">
              <p className="text-xs text-neutral-500 font-medium">
                O que acontece agora:
              </p>
              <p className="text-xs text-neutral-600">
                1. Realize o pagamento pelo método escolhido.
              </p>
              <p className="text-xs text-neutral-600">
                2. Nossa equipe confirma manualmente e o status muda para{" "}
                <strong>Pagamento Confirmado / Liberado para Retirada</strong>.
              </p>
              <p className="text-xs text-neutral-600">
                3. Entraremos em contato pelo{" "}
                {contactType === "WHATSAPP" ? "WhatsApp" : "email"}{" "}
                <strong>{contact}</strong>.
              </p>
            </div>

            <Button className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
