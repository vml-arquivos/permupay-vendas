/**
 * ConfiguracoesPagamento.tsx — Configurações Globais de Pagamento
 *
 * Tela separada para configurar as taxas de cartão e desconto
 * para pagamento em dinheiro/PIX. Os valores ficam travados
 * após salvar — é necessário clicar em "Editar" para alterar.
 *
 * Campos gerenciados aqui (removidos do ProductForm):
 *   - Taxa débito
 *   - Taxa crédito à vista
 *   - Taxa crédito parcelado
 *   - Número de parcelas
 *   - Desconto pagamento em dinheiro/PIX (%)
 *
 * NOTA: usa useEffect para sincronizar o form com query.data porque
 * onSuccess foi removido do useQuery no React Query v5 / tRPC v11.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreditCard,
  Lock,
  Unlock,
  Save,
  Loader2,
  Info,
  Banknote,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

function FF({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NI({
  value,
  onChange,
  suffix,
  prefix,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  prefix?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-xs text-muted-foreground font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        step="any"
        min={0}
        disabled={disabled}
        className={`h-9 text-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${disabled ? "bg-muted/50 cursor-not-allowed" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export default function ConfiguracoesPagamento() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cardDebitFee: "",
    cardCreditCashFee: "",
    cardCreditInstallmentFee: "",
    cardInstallments: "",
    cashDiscountPercent: "",
  });

  // React Query v5 / tRPC v11 removeram onSuccess do useQuery.
  // Usamos useEffect para popular o form quando os dados chegam do servidor.
  const query = trpc.paymentSettings.get.useQuery();

  useEffect(() => {
    if (query.data && !editing) {
      setForm({
        cardDebitFee: String(query.data.cardDebitFee),
        cardCreditCashFee: String(query.data.cardCreditCashFee),
        cardCreditInstallmentFee: String(query.data.cardCreditInstallmentFee),
        cardInstallments: String(query.data.cardInstallments),
        cashDiscountPercent: String(query.data.cashDiscountPercent),
      });
    }
  }, [query.data, editing]);

  const updateMutation = trpc.paymentSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações de pagamento salvas!");
      setEditing(false);
      query.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const n = (v: string) => {
    const p = parseFloat(v.replace(",", "."));
    return isNaN(p) ? 0 : p;
  };

  const handleSave = () => {
    updateMutation.mutate({
      cardDebitFee: n(form.cardDebitFee),
      cardCreditCashFee: n(form.cardCreditCashFee),
      cardCreditInstallmentFee: n(form.cardCreditInstallmentFee),
      cardInstallments: n(form.cardInstallments),
      cashDiscountPercent: n(form.cashDiscountPercent),
    });
  };

  const handleCancelEdit = () => {
    setEditing(false);
    if (query.data) {
      setForm({
        cardDebitFee: String(query.data.cardDebitFee),
        cardCreditCashFee: String(query.data.cardCreditCashFee),
        cardCreditInstallmentFee: String(query.data.cardCreditInstallmentFee),
        cardInstallments: String(query.data.cardInstallments),
        cashDiscountPercent: String(query.data.cashDiscountPercent),
      });
    }
  };

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const cashDiscount = n(form.cashDiscountPercent);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Configurações de Pagamento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Taxas globais de cartão e desconto para pagamento à vista. Estas
              configurações são aplicadas automaticamente nos cálculos de
              precificação.
            </p>
          </div>
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="shrink-0 gap-2"
            >
              <Unlock className="w-4 h-4" />
              Editar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              className="shrink-0 gap-2 text-muted-foreground"
            >
              Cancelar
            </Button>
          )}
        </div>

        {/* Aviso de bloqueio */}
        {!editing && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Configurações travadas. Clique em{" "}
              <strong className="text-foreground">Editar</strong> para
              modificar.
            </span>
          </div>
        )}

        {/* Cartão */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Taxas de Cartão
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Taxas cobradas pela operadora de cartão
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FF label="Taxa débito (%)">
                <NI
                  value={form.cardDebitFee}
                  onChange={set("cardDebitFee")}
                  suffix="%"
                  placeholder="1.5"
                  disabled={!editing}
                />
              </FF>
              <FF label="Taxa crédito à vista (%)">
                <NI
                  value={form.cardCreditCashFee}
                  onChange={set("cardCreditCashFee")}
                  suffix="%"
                  placeholder="2.5"
                  disabled={!editing}
                />
              </FF>
              <FF label="Taxa crédito parcelado (%)">
                <NI
                  value={form.cardCreditInstallmentFee}
                  onChange={set("cardCreditInstallmentFee")}
                  suffix="%"
                  placeholder="3.5"
                  disabled={!editing}
                />
              </FF>
              <FF label="Número de parcelas">
                <NI
                  value={form.cardInstallments}
                  onChange={set("cardInstallments")}
                  placeholder="6"
                  disabled={!editing}
                />
              </FF>
            </div>
          </CardContent>
        </Card>

        {/* Desconto dinheiro/PIX */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Desconto Pagamento em Dinheiro / PIX
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Percentual de desconto aplicado automaticamente para
                  pagamentos à vista
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FF
              label="Desconto (%)"
              hint="Ex: 5 = 5% de desconto no preço quando o cliente paga em dinheiro ou PIX"
            >
              <NI
                value={form.cashDiscountPercent}
                onChange={set("cashDiscountPercent")}
                suffix="%"
                placeholder="0"
                disabled={!editing}
              />
            </FF>

            {/* Preview do desconto */}
            {cashDiscount > 0 && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30">
                <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">
                      Desconto de {cashDiscount}% ativo
                    </p>
                    <p className="text-xs mt-0.5 text-green-600 dark:text-green-500">
                      Exemplo: produto a R$ 100,00 → preço PIX/dinheiro R${" "}
                      {(100 * (1 - cashDiscount / 100)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botão salvar */}
        {editing && (
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar configurações
            </Button>
          </div>
        )}

        {/* Resumo atual (quando travado) */}
        {!editing && query.data && (
          <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              Configuração atual
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: "Débito", value: `${query.data.cardDebitFee}%` },
                { label: "Crédito à vista", value: `${query.data.cardCreditCashFee}%` },
                { label: "Crédito parcelado", value: `${query.data.cardCreditInstallmentFee}%` },
                { label: "Parcelas", value: `${query.data.cardInstallments}x` },
                {
                  label: "Desconto PIX/dinheiro",
                  value:
                    query.data.cashDiscountPercent > 0
                      ? `${query.data.cashDiscountPercent}%`
                      : "Sem desconto",
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
