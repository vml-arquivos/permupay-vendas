/**
 * BuyModal.tsx — Modal de reserva/compra
 * Fluxo: cliente preenche dados → reserva criada → aguarda confirmação admin
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, CheckCircle, Clock, Zap, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type PaymentMethod = "PIX" | "CARTAO" | "BOLETO";

interface BuyModalProps {
  product: {
    id: number;
    name: string;
    suggestedPricePix: number;
    suggestedPriceCard: number;
    suggestedPriceBoleto: number;
    suggestedPrice: number;
    cardInstallments?: number | null;
    boletoMonths?: number | null;
  };
  onClose: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BuyModal({ product: p, onClose }: BuyModalProps) {
  const [step, setStep] = useState<"method" | "form" | "success">("method");
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [contactType, setContactType] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [orderId, setOrderId] = useState<number | null>(null);

  const pixPrice = (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix : p.suggestedPrice;
  const cardPrice = (p.suggestedPriceCard ?? 0) > 0 ? p.suggestedPriceCard : p.suggestedPrice;
  const boletoPrice = (p.suggestedPriceBoleto ?? 0) > 0 ? p.suggestedPriceBoleto : p.suggestedPrice;
  const inst = Math.max(1, Math.round(p.cardInstallments ?? 3));
  const boletoMonths = Math.max(1, Math.round(p.boletoMonths ?? 3));

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

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!contact.trim()) return toast.error("Informe seu WhatsApp ou email");

    createOrder.mutate({
      productId: p.id,
      quantity: 1,
      buyerName: name.trim(),
      buyerContact: contact.trim(),
      buyerContactType: contactType,
      paymentMethod: method,
      unitPrice: priceByMethod[method],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900 text-base">
            {step === "success" ? "Reserva Confirmada!" : `Comprar — ${p.name}`}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: escolha do método */}
        {step === "method" && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-neutral-500">Escolha como deseja pagar:</p>

            <div className="space-y-2">
              {/* PIX */}
              <button
                onClick={() => setMethod("PIX")}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                  method === "PIX"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Zap className={`w-5 h-5 ${method === "PIX" ? "text-emerald-600" : "text-neutral-400"}`} />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-neutral-900">PIX / À Vista</p>
                    <p className="text-xs text-neutral-500">Pagamento instantâneo</p>
                  </div>
                </div>
                <span className="text-base font-bold text-neutral-900">{fmt(pixPrice)}</span>
              </button>

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
                    <CreditCard className={`w-5 h-5 ${method === "CARTAO" ? "text-blue-600" : "text-neutral-400"}`} />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-neutral-900">Cartão de Crédito</p>
                      <p className="text-xs text-neutral-500">{inst}x de {fmt(cardPrice / inst)}</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-neutral-900">{fmt(cardPrice)}</span>
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
                    <FileText className={`w-5 h-5 ${method === "BOLETO" ? "text-orange-600" : "text-neutral-400"}`} />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-neutral-900">Boleto Parcelado</p>
                      <p className="text-xs text-neutral-500">{boletoMonths}x de {fmt(boletoPrice / boletoMonths)}</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-neutral-900">{fmt(boletoPrice)}</span>
                </button>
              )}
            </div>

            <Button className="w-full mt-2" onClick={() => setStep("form")}>
              Continuar
            </Button>
          </div>
        )}

        {/* Step: dados do comprador */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Método:</span>
              <span className="font-semibold text-neutral-900">
                {method === "PIX" ? "PIX" : method === "CARTAO" ? "Cartão" : "Boleto"} —{" "}
                {fmt(priceByMethod[method])}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">Seu nome *</label>
                <Input
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">Contato *</label>
                <div className="flex gap-2">
                  <select
                    value={contactType}
                    onChange={(e) => setContactType(e.target.value as "WHATSAPP" | "EMAIL")}
                    className="border border-input rounded-md px-2 py-2 text-sm bg-background"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                  <Input
                    placeholder={contactType === "WHATSAPP" ? "(11) 99999-9999" : "seu@email.com"}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="text-xs text-amber-800">
                <strong>Como funciona:</strong> Ao confirmar, seu pedido fica reservado por{" "}
                <strong>2 horas</strong>. Após você efetuar o pagamento, nossa equipe confirma
                manualmente e finaliza o pedido.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("method")} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createOrder.isPending}
                className="flex-1"
              >
                {createOrder.isPending ? "Reservando..." : "Confirmar Reserva"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: sucesso */}
        {step === "success" && (
          <div className="px-6 py-8 text-center space-y-4">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <div>
              <h3 className="font-bold text-neutral-900 text-lg">Reserva #{orderId} criada!</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Seu pedido está reservado. Agora efetue o pagamento e aguarde nossa confirmação.
              </p>
            </div>

            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-start gap-2 text-left">
              <Clock className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-800">
                Sua reserva expira em <strong>2 horas</strong>. Se o pagamento não for
                confirmado nesse prazo, o produto volta ao estoque automaticamente.
              </p>
            </div>

            <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3 text-left space-y-1">
              <p className="text-xs text-neutral-500">Forma de pagamento</p>
              <p className="text-sm font-semibold">
                {method === "PIX" ? "PIX — " : method === "CARTAO" ? "Cartão — " : "Boleto — "}
                {fmt(priceByMethod[method])}
              </p>
              <p className="text-xs text-neutral-500 mt-2">
                Nossa equipe entrará em contato pelo {contactType === "WHATSAPP" ? "WhatsApp" : "email"}{" "}
                <strong>{contact}</strong> para finalizar.
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
