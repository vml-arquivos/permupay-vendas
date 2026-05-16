/**
 * WishlistPublic.tsx — Página pública /desejos
 *
 * Permite que visitantes registrem o que estão procurando.
 * Design: limpo, acolhedor, moderno. Sem login necessário.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Send,
  CheckCircle2,
  ArrowLeft,
  Clock,
  PhoneCall,
  Package,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ContactType = "WHATSAPP" | "EMAIL";

interface FormState {
  visitorName: string;
  contact: string;
  contactType: ContactType;
  category: string;
  brand: string;
  model: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
}

const INITIAL: FormState = {
  visitorName: "",
  contact: "",
  contactType: "WHATSAPP",
  category: "",
  brand: "",
  model: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
};

const CATEGORY_LABELS: Record<string, string> = {
  CELULAR: "📱 Celular / Smartphone",
  ELETRONICO: "💻 Eletrônico",
  PERFUME: "🌸 Perfume / Fragrância",
  OUTRO: "📦 Outro",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  NOVO: { label: "Recebido", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  VISUALIZADO: { label: "Em análise", color: "bg-blue-100 text-blue-800", icon: Clock },
  CONTATADO: {
    label: "Em contato",
    color: "bg-orange-100 text-orange-800",
    icon: PhoneCall,
  },
  ATENDIDO: {
    label: "Atendido ✓",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  FECHADO: { label: "Encerrado", color: "bg-gray-100 text-gray-600", icon: Package },
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WishlistPublic() {
  const [, nav] = useLocation();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [submittedContact, setSubmittedContact] = useState("");
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [lookupContact, setLookupContact] = useState("");

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Mutations e queries
  const createMutation = trpc.wishlist.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmittedContact(form.contact);
    },
    onError: (err) => setErrors({ description: err.message }),
  });

  const myRequestsQuery = trpc.wishlist.myRequests.useQuery(
    { contact: lookupContact },
    { enabled: showMyRequests && lookupContact.length >= 8 }
  );

  // Validação
  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.visitorName.trim()) errs.visitorName = "Informe seu nome";
    if (!form.contact.trim()) errs.contact = "Informe WhatsApp ou email";
    if (!form.description.trim() || form.description.length < 10)
      errs.description = "Descreva melhor (mín. 10 caracteres)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      visitorName: form.visitorName.trim(),
      contact: form.contact.trim(),
      contactType: form.contactType as "WHATSAPP" | "EMAIL",
      category: (form.category as any) || undefined,
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      description: form.description.trim(),
      budgetMin: parseFloat(form.budgetMin.replace(",", ".")) || 0,
      budgetMax: parseFloat(form.budgetMax.replace(",", ".")) || 0,
    });
  };

  // ── Tela de sucesso ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Desejo registrado!</h1>
            <p className="text-muted-foreground">
              Obrigado, <strong>{form.visitorName}</strong>! Quando tivermos o
              produto que você procura, entraremos em contato via{" "}
              {form.contactType === "WHATSAPP" ? "WhatsApp" : "email"} no número{" "}
              <strong>{form.contact}</strong>.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 text-left space-y-2">
            <p className="text-sm font-medium">O que você registrou:</p>
            {form.category && (
              <p className="text-sm text-muted-foreground">
                📦 {CATEGORY_LABELS[form.category]}
              </p>
            )}
            {form.brand && (
              <p className="text-sm text-muted-foreground">🏷️ Marca: {form.brand}</p>
            )}
            {form.model && (
              <p className="text-sm text-muted-foreground">
                📋 Modelo: {form.model}
              </p>
            )}
            <p className="text-sm text-muted-foreground">💬 {form.description}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setForm(INITIAL);
                setSubmitted(false);
              }}
              variant="outline"
            >
              Registrar outro desejo
            </Button>
            <Button
              onClick={() => nav("/")}
              variant="ghost"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Ver catálogo de produtos
            </Button>
          </div>

          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => {
              setLookupContact(submittedContact);
              setShowMyRequests(true);
              setSubmitted(false);
            }}
          >
            Ver meus pedidos registrados
          </button>
        </div>
      </div>
    );
  }

  // ── Consulta de pedidos ─────────────────────────────────────────────────────
  if (showMyRequests) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
          <button
            onClick={() => setShowMyRequests(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div>
            <h1 className="text-2xl font-bold">Meus pedidos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhe o status dos seus desejos registrados
            </p>
          </div>

          <div className="space-y-2">
            <Label>Seu WhatsApp ou email</Label>
            <div className="flex gap-2">
              <Input
                value={lookupContact}
                onChange={(e) => setLookupContact(e.target.value)}
                placeholder="Ex: 61999999999"
                className="flex-1"
              />
            </div>
          </div>

          {myRequestsQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {myRequestsQuery.data?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum pedido encontrado para este contato.
            </div>
          )}

          {myRequestsQuery.data && myRequestsQuery.data.length > 0 && (
            <div className="space-y-3">
              {myRequestsQuery.data.map((req) => {
                const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG["NOVO"];
                return (
                  <div
                    key={req.id}
                    className="rounded-xl border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug">
                        {req.description}
                      </p>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    {(req.category || req.brand || req.model) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          req.category && CATEGORY_LABELS[req.category],
                          req.brand,
                          req.model,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {(req.budgetMin > 0 || req.budgetMax > 0) && (
                      <p className="text-xs text-muted-foreground">
                        💰{" "}
                        {req.budgetMin > 0 && req.budgetMax > 0
                          ? `${formatBRL(req.budgetMin)} – ${formatBRL(req.budgetMax)}`
                          : req.budgetMax > 0
                          ? `até ${formatBRL(req.budgetMax)}`
                          : `a partir de ${formatBRL(req.budgetMin)}`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Formulário principal ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent border-b">
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Desejos</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Não encontrou o que procura? Registre aqui e entraremos em contato
            assim que o produto estiver disponível.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Seção 1 — Quem é você */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold border-b pb-2">
              Seus dados de contato
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome *</Label>
                <Input
                  id="name"
                  value={form.visitorName}
                  onChange={(e) => set("visitorName", e.target.value)}
                  placeholder="Como prefere ser chamado?"
                />
                {errors.visitorName && (
                  <p className="text-xs text-destructive">{errors.visitorName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactType">Forma de contato *</Label>
                <Select
                  value={form.contactType}
                  onValueChange={(v) => set("contactType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">📱 WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">📧 Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">
                {form.contactType === "WHATSAPP" ? "Número WhatsApp *" : "Email *"}
              </Label>
              <Input
                id="contact"
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder={
                  form.contactType === "WHATSAPP"
                    ? "Ex: 61999999999 (com DDD)"
                    : "seu@email.com"
                }
                type={form.contactType === "EMAIL" ? "email" : "tel"}
              />
              {errors.contact && (
                <p className="text-xs text-destructive">{errors.contact}</p>
              )}
            </div>
          </section>

          {/* Seção 2 — O que procura */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold border-b pb-2">
              O que você está procurando?
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  placeholder="Ex: Samsung, Apple, Nike"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(e) => set("model", e.target.value)}
                  placeholder="Ex: Galaxy S24, iPhone 15 Pro"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição detalhada *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Descreva o que procura: cor, capacidade, características importantes, condição (novo/seminovo)..."
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-between">
                {errors.description ? (
                  <p className="text-xs text-destructive">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span
                  className={`text-xs ${
                    form.description.length < 10
                      ? "text-muted-foreground"
                      : "text-green-600"
                  }`}
                >
                  {form.description.length} caracteres
                </span>
              </div>
            </div>
          </section>

          {/* Seção 3 — Orçamento */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold border-b pb-2">
              Faixa de orçamento{" "}
              <span className="text-muted-foreground font-normal text-sm">
                (opcional)
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="budgetMin">Valor mínimo (R$)</Label>
                <Input
                  id="budgetMin"
                  value={form.budgetMin}
                  onChange={(e) => set("budgetMin", e.target.value)}
                  placeholder="Ex: 500"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budgetMax">Valor máximo (R$)</Label>
                <Input
                  id="budgetMax"
                  value={form.budgetMax}
                  onChange={(e) => set("budgetMax", e.target.value)}
                  placeholder="Ex: 1200"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </section>

          {/* Submit */}
          <div className="space-y-3 pt-2">
            <Button
              type="submit"
              className="w-full gap-2 h-12 text-base"
              disabled={createMutation.isPending}
            >
              <Send className="w-4 h-4" />
              {createMutation.isPending ? "Registrando..." : "Registrar meu desejo"}
            </Button>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => nav("/")}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ver catálogo
              </button>
              <button
                type="button"
                onClick={() => setShowMyRequests(true)}
                className="hover:text-foreground transition-colors"
              >
                Ver meus pedidos
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
