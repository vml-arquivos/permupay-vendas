import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import ImageGallery from "@/components/ImageGallery";
import { toast } from "sonner";

type Category = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";
type TaxRegime = "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL" | "MANUAL";
type PaymentPlatform = "MERCADO_PAGO" | "PAGSEGURO" | "OUTRO";

type FormData = {
  name: string;
  shortDescription: string;
  description: string;
  category: Category;
  categoryLabel: string;
  ncm: string;
  promoTag: string;
  published: boolean;
  // Precificação
  costPrice: number;
  packagingCost: number;
  inboundShippingCost: number;
  operationalCost: number;
  taxRegime: TaxRegime;
  estimatedTaxRate: number;
  desiredMarginRate: number;
  costCurrency: "BRL" | "USD";
  costPriceUsd: number;
  usdExchangeRate: number;
  // Estoque
  stockQuantity: number;
  minimumStock: number;
  notes: string;
  active: boolean;
  // Pagamento
  paymentPlatform: PaymentPlatform;
  pixKey: string;
  pixLink: string;
  cardPaymentUrl: string;
  boletoUrl: string;
};

const initial: FormData = {
  name: "",
  shortDescription: "",
  description: "",
  category: "CELULAR",
  categoryLabel: "",
  ncm: "",
  promoTag: "",
  published: false,
  costPrice: 0,
  packagingCost: 0,
  inboundShippingCost: 0,
  operationalCost: 0,
  taxRegime: "SIMPLES_NACIONAL",
  estimatedTaxRate: 0,
  desiredMarginRate: 0,
  costCurrency: "BRL",
  costPriceUsd: 0,
  usdExchangeRate: 0,
  stockQuantity: 0,
  minimumStock: 0,
  notes: "",
  active: true,
  paymentPlatform: "MERCADO_PAGO",
  pixKey: "",
  pixLink: "",
  cardPaymentUrl: "",
  boletoUrl: "",
};

const CATEGORY_LABELS: Record<Category, string> = {
  CELULAR: "Celular",
  ELETRONICO: "Eletrônico",
  PERFUME: "Perfume",
  OUTRO: "Outro",
};

const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  MANUAL: "Manual",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductForm({ id }: { id?: number }) {
  const [, nav] = useLocation();
  const utils = trpc.useUtils();
  const isEdit = !!id;
  const { data, isLoading } = trpc.products.byId.useQuery(
    { id: id! },
    { enabled: isEdit }
  );
  const [f, setF] = useState<FormData>(initial);

  useEffect(() => {
    if (data) {
      setF({
        ...initial,
        ...data,
        ncm: data.ncm ?? "",
        notes: data.notes ?? "",
        shortDescription: (data as any).shortDescription ?? "",
        description: (data as any).description ?? "",
        categoryLabel: (data as any).categoryLabel ?? "",
        promoTag: data.promoTag ?? "",
        published: data.published ?? false,
        paymentPlatform: ((data as any).paymentPlatform as PaymentPlatform) ?? "MERCADO_PAGO",
        pixKey: (data as any).pixKey ?? "",
        pixLink: (data as any).pixLink ?? "",
        cardPaymentUrl: (data as any).cardPaymentUrl ?? "",
        boletoUrl: (data as any).boletoUrl ?? "",
      });
    }
  }, [data]);

  const create = trpc.products.create.useMutation({
    onSuccess: async () => {
      await utils.products.list.invalidate();
      toast.success("Produto criado com sucesso!");
      nav("/produtos");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.products.update.useMutation({
    onSuccess: async () => {
      await utils.products.list.invalidate();
      if (id) await utils.products.byId.invalidate({ id });
      toast.success("Produto atualizado com sucesso!");
      nav("/produtos");
    },
    onError: (e) => toast.error(e.message),
  });

  // Calcular custo em BRL
  const costPriceBrl = useMemo(() => {
    if (f.costCurrency === "USD") return f.costPriceUsd * f.usdExchangeRate;
    return f.costPrice;
  }, [f.costCurrency, f.costPrice, f.costPriceUsd, f.usdExchangeRate]);

  // Calcular preços sugeridos em tempo real
  const calcPrecos = useMemo(() => {
    const custoTotal =
      costPriceBrl + f.packagingCost + f.inboundShippingCost + f.operationalCost;
    const margem = (f.desiredMarginRate || 0) / 100;
    const imposto = (f.estimatedTaxRate || 0) / 100;
    const divisor = 1 - margem - imposto;
    if (divisor <= 0) return null;
    const base = custoTotal / divisor;
    return {
      custoTotal,
      pix: base,
      cartao: base / (1 - 0.0299),
      boleto: base / (1 - 0.015),
      margemReal: ((base - custoTotal) / base) * 100,
    };
  }, [
    costPriceBrl,
    f.packagingCost,
    f.inboundShippingCost,
    f.operationalCost,
    f.desiredMarginRate,
    f.estimatedTaxRate,
  ]);

  const setNum = (k: keyof FormData, v: string) => {
    const parsed = Number(v.replace(",", "."));
    setF((prev) => ({ ...prev, [k]: Number.isFinite(parsed) ? parsed : 0 }));
  };



  const save = () => {
    if (!f.name.trim()) {
      toast.error("Nome do produto é obrigatório.");
      return;
    }
    const payload = {
      ...f,
      suggestedPrice: calcPrecos?.pix ?? 0,
      suggestedPricePix: calcPrecos?.pix ?? 0,
      suggestedPriceCard: calcPrecos?.cartao ?? 0,
      suggestedPriceBoleto: calcPrecos?.boleto ?? 0,
    };
    if (isEdit) {
      update.mutate({ id: id!, data: payload });
    } else {
      create.mutate(payload);
    }
  };

  if (isEdit && isLoading)
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Carregando produto...
      </div>
    );
  if (isEdit && !data)
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Produto não encontrado.
      </div>
    );

  const isNegativeMargin = calcPrecos !== null && calcPrecos.margemReal < 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Editar Produto" : "Novo Produto"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha os dados do produto para o catálogo e vitrine
          </p>
        </div>
        <Badge variant={f.published ? "default" : "secondary"}>
          {f.published ? "Publicado" : "Rascunho"}
        </Badge>
      </div>

      {/* ── SEÇÃO 1: Identidade do Produto ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade do Produto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Galeria de imagens */}
          {isEdit ? (
            <ImageGallery productId={id!} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
              Salve o produto primeiro para adicionar imagens à galeria.
            </div>
          )}

          {/* Nome e descrição curta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Nome do Produto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: iPhone 15 Pro Max 256GB"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shortDescription">
                  Descrição Curta{" "}
                  <span className="text-muted-foreground text-xs">
                    (máx. 120 caracteres)
                  </span>
                </Label>
                <Input
                  id="shortDescription"
                  placeholder="Ex: Smartphone com câmera de 200MP e bateria de longa duração"
                  maxLength={120}
                  value={f.shortDescription}
                  onChange={(e) =>
                    setF({ ...f, shortDescription: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground text-right">
                  {f.shortDescription.length}/120
                </p>
              </div>
          </div>

          {/* Descrição completa */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição Completa</Label>
            <Textarea
              id="description"
              placeholder="Descreva detalhadamente o produto: especificações, diferenciais, garantia..."
              rows={4}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoria */}
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={f.category}
                onValueChange={(v) => setF({ ...f, category: v as Category })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label de categoria */}
            <div className="space-y-1.5">
              <Label htmlFor="categoryLabel">
                Label de Categoria Customizável
              </Label>
              <Input
                id="categoryLabel"
                placeholder="Ex: Eletrônicos Premium"
                value={f.categoryLabel}
                onChange={(e) =>
                  setF({ ...f, categoryLabel: e.target.value })
                }
              />
            </div>

            {/* NCM */}
            <div className="space-y-1.5">
              <Label htmlFor="ncm">NCM (opcional)</Label>
              <Input
                id="ncm"
                placeholder="Ex: 8517.12.31"
                value={f.ncm}
                onChange={(e) => setF({ ...f, ncm: e.target.value })}
              />
            </div>

            {/* Tag de promoção */}
            <div className="space-y-1.5">
              <Label htmlFor="promoTag">Tag de Promoção</Label>
              <Input
                id="promoTag"
                placeholder="Ex: LANÇAMENTO, OFERTA, DESTAQUE"
                value={f.promoTag}
                onChange={(e) => setF({ ...f, promoTag: e.target.value })}
              />
            </div>
          </div>

          {/* Publicar na vitrine */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Publicar na vitrine</p>
              <p className="text-xs text-muted-foreground">
                Produto ficará visível no catálogo público
              </p>
            </div>
            <Switch
              checked={f.published}
              onCheckedChange={(v) => setF({ ...f, published: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── SEÇÃO 2: Precificação ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Precificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Moeda */}
            <div className="space-y-1.5">
              <Label>Moeda de Custo</Label>
              <Select
                value={f.costCurrency}
                onValueChange={(v) =>
                  setF({ ...f, costCurrency: v as "BRL" | "USD" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (BRL)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preço de custo */}
            {f.costCurrency === "BRL" ? (
              <div className="space-y-1.5">
                <Label htmlFor="costPrice">Preço de Custo (R$)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min={0}
                  step={0.01}
                  value={f.costPrice}
                  onChange={(e) => setNum("costPrice", e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="costPriceUsd">Preço de Custo (USD)</Label>
                  <Input
                    id="costPriceUsd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={f.costPriceUsd}
                    onChange={(e) => setNum("costPriceUsd", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="usdExchangeRate">Cotação do Dólar</Label>
                  <Input
                    id="usdExchangeRate"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Ex: 5.25"
                    value={f.usdExchangeRate}
                    onChange={(e) => setNum("usdExchangeRate", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Custo de embalagem */}
            <div className="space-y-1.5">
              <Label htmlFor="packagingCost">Custo de Embalagem (R$)</Label>
              <Input
                id="packagingCost"
                type="number"
                min={0}
                step={0.01}
                value={f.packagingCost}
                onChange={(e) => setNum("packagingCost", e.target.value)}
              />
            </div>

            {/* Frete de entrada */}
            <div className="space-y-1.5">
              <Label htmlFor="inboundShippingCost">Frete de Entrada (R$)</Label>
              <Input
                id="inboundShippingCost"
                type="number"
                min={0}
                step={0.01}
                value={f.inboundShippingCost}
                onChange={(e) =>
                  setNum("inboundShippingCost", e.target.value)
                }
              />
            </div>

            {/* Custo operacional */}
            <div className="space-y-1.5">
              <Label htmlFor="operationalCost">Custo Operacional (R$)</Label>
              <Input
                id="operationalCost"
                type="number"
                min={0}
                step={0.01}
                value={f.operationalCost}
                onChange={(e) => setNum("operationalCost", e.target.value)}
              />
            </div>

            {/* Regime fiscal */}
            <div className="space-y-1.5">
              <Label>Regime Fiscal</Label>
              <Select
                value={f.taxRegime}
                onValueChange={(v) =>
                  setF({ ...f, taxRegime: v as TaxRegime })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TAX_REGIME_LABELS) as TaxRegime[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {TAX_REGIME_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alíquota */}
            <div className="space-y-1.5">
              <Label htmlFor="estimatedTaxRate">Alíquota Estimada (%)</Label>
              <Input
                id="estimatedTaxRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={f.estimatedTaxRate}
                onChange={(e) => setNum("estimatedTaxRate", e.target.value)}
              />
            </div>

            {/* Margem desejada */}
            <div className="space-y-1.5">
              <Label htmlFor="desiredMarginRate">Margem Desejada (%)</Label>
              <Input
                id="desiredMarginRate"
                type="number"
                min={0}
                max={99}
                step={0.1}
                value={f.desiredMarginRate}
                onChange={(e) => setNum("desiredMarginRate", e.target.value)}
              />
            </div>
          </div>

          {/* Painel de resultado calculado */}
          <div
            className={`rounded-xl p-4 border ${
              isNegativeMargin
                ? "bg-destructive/5 border-destructive/20"
                : "bg-primary/5 border-primary/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              {isNegativeMargin ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              <p className="text-sm font-semibold">Resultado do Cálculo</p>
            </div>
            {calcPrecos === null ? (
              <p className="text-sm text-muted-foreground">
                Margem + imposto não pode ser ≥ 100%. Ajuste os valores.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Custo Total</p>
                  <p className="text-sm font-semibold">
                    {formatBRL(calcPrecos.custoTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Preço PIX (sugerido)
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      isNegativeMargin ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {formatBRL(calcPrecos.pix)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Preço Cartão (+2,99%)
                  </p>
                  <p className="text-sm font-semibold">
                    {formatBRL(calcPrecos.cartao)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Preço Boleto (+1,5%)
                  </p>
                  <p className="text-sm font-semibold">
                    {formatBRL(calcPrecos.boleto)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem Real</p>
                  <p
                    className={`text-sm font-bold ${
                      isNegativeMargin ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {calcPrecos.margemReal.toFixed(2)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── SEÇÃO 3: Estoque ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="stockQuantity">Quantidade em Estoque</Label>
              <Input
                id="stockQuantity"
                type="number"
                min={0}
                step={1}
                value={f.stockQuantity}
                onChange={(e) => setNum("stockQuantity", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minimumStock">Estoque Mínimo</Label>
              <Input
                id="minimumStock"
                type="number"
                min={0}
                step={1}
                value={f.minimumStock}
                onChange={(e) => setNum("minimumStock", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="notes">Notas Internas</Label>
            <Textarea
              id="notes"
              placeholder="Observações internas sobre o produto..."
              rows={2}
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── SEÇÃO 4: Configurações de Pagamento ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plataforma */}
          <div className="space-y-1.5">
            <Label>Plataforma de Pagamento</Label>
            <Select
              value={f.paymentPlatform}
              onValueChange={(v) =>
                setF({ ...f, paymentPlatform: v as PaymentPlatform })
              }
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                <SelectItem value="PAGSEGURO">PagSeguro</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chave PIX */}
            <div className="space-y-1.5">
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                value={f.pixKey}
                onChange={(e) => setF({ ...f, pixKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Chave PIX cadastrada na sua conta bancária ou plataforma de pagamento.
              </p>
            </div>

            {/* Link PIX */}
            <div className="space-y-1.5">
              <Label htmlFor="pixLink">Link de Pagamento PIX</Label>
              <Input
                id="pixLink"
                placeholder="https://..."
                value={f.pixLink}
                onChange={(e) => setF({ ...f, pixLink: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL gerada no Mercado Pago / PagSeguro para pagamento via PIX.
              </p>
            </div>

            {/* Link Cartão */}
            <div className="space-y-1.5">
              <Label htmlFor="cardPaymentUrl">Link de Pagamento com Cartão</Label>
              <Input
                id="cardPaymentUrl"
                placeholder="https://..."
                value={f.cardPaymentUrl}
                onChange={(e) => setF({ ...f, cardPaymentUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL do checkout da plataforma para pagamento com cartão de crédito/débito.
              </p>
            </div>

            {/* Link Boleto */}
            <div className="space-y-1.5">
              <Label htmlFor="boletoUrl">Link de Boleto</Label>
              <Input
                id="boletoUrl"
                placeholder="https://..."
                value={f.boletoUrl}
                onChange={(e) => setF({ ...f, boletoUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL gerada pela plataforma para emissão de boleto bancário.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Rodapé ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <Button variant="outline" onClick={() => nav("/produtos")}>
          Cancelar
        </Button>
        <Button
          onClick={save}
          disabled={create.isPending || update.isPending}
          className="min-w-32"
        >
          {create.isPending || update.isPending
            ? "Salvando..."
            : "Salvar Produto"}
        </Button>
      </div>
    </div>
  );
}
