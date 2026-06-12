/**
 * CotacaoLocais.tsx — Gerenciamento de locais de pesquisa
 * PWA mobile-first com sheet de criação/edição inline
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Pencil, Trash2, MapPin, Navigation, Store, X, Check,
} from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["Supermercado","Atacado","Feira","Hortifrúti","Açougue","Padaria","Farmácia","Outro"];

interface Form {
  id?: number; nome: string; endereco: string;
  tipoComercio: string; custo: string; lat: string; lng: string;
}
const EMPTY: Form = { nome: "", endereco: "", tipoComercio: "", custo: "0", lat: "", lng: "" };

export default function CotacaoLocais() {
  const [, nav] = useLocation();
  const utils = trpc.useUtils();

  const [sheet, setSheet] = useState(false);
  const [form, setForm]   = useState<Form>(EMPTY);
  const [gps, setGps]     = useState(false);
  const [filtro, setFiltro] = useState("");

  const { data: locais, isLoading } = trpc.cotacao.locais.listar.useQuery();
  const criar    = trpc.cotacao.locais.criar.useMutation({
    onSuccess: () => { utils.cotacao.locais.listar.invalidate(); close(); toast.success("Local cadastrado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const atualizar = trpc.cotacao.locais.atualizar.useMutation({
    onSuccess: () => { utils.cotacao.locais.listar.invalidate(); close(); toast.success("Local atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remover  = trpc.cotacao.locais.remover.useMutation({
    onSuccess: () => { utils.cotacao.locais.listar.invalidate(); toast.success("Local removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  function close() { setSheet(false); setForm(EMPTY); }
  function openNew() { setForm(EMPTY); setSheet(true); }
  function openEdit(l: any) {
    setForm({ id: l.id, nome: l.nome, endereco: l.endereco ?? "", tipoComercio: l.tipoComercio ?? "", custo: String(l.custoOperacionalPadrao ?? "0"), lat: String(l.lat ?? ""), lng: String(l.lng ?? "") });
    setSheet(true);
  }

  function captureGPS() {
    if (!navigator.geolocation) { toast.error("GPS não disponível"); return; }
    setGps(true);
    navigator.geolocation.getCurrentPosition(
      p => { setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(7), lng: p.coords.longitude.toFixed(7) })); setGps(false); toast.success("Localização capturada!"); },
      e => { setGps(false); toast.error("GPS: " + e.message); }
    );
  }

  function save() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    const payload = {
      nome: form.nome.trim(),
      endereco: form.endereco || undefined,
      tipoComercio: form.tipoComercio || undefined,
      custoOperacionalPadrao: form.custo || "0",
      lat: form.lat || undefined,
      lng: form.lng || undefined,
    };
    if (form.id) atualizar.mutate({ id: form.id, ...payload });
    else criar.mutate(payload);
  }

  const saving = criar.isPending || atualizar.isPending;
  const lista = (locais ?? []).filter(l => !filtro || l.nome.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <>
      <div className="min-h-svh bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Header */}
        <div className="bg-[oklch(0.30_0.13_240)] text-white px-4 pt-10 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => nav("/cotacoes")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold">Locais de Pesquisa</h1>
              <p className="text-xs opacity-60">Onde você vai coletar preços</p>
            </div>
            <button onClick={openNew} className="h-9 w-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {/* Busca */}
          <div className="bg-white/10 rounded-xl flex items-center gap-2 px-3 py-2">
            <MapPin className="h-4 w-4 opacity-50 shrink-0" />
            <input
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none"
              placeholder="Buscar local..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
            {filtro && <button onClick={() => setFiltro("")} className="text-white/50 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-28">
          <div className="px-4 py-4 space-y-2">
            {isLoading && [0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}

            {!isLoading && lista.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{filtro ? "Nenhum resultado" : "Nenhum local ainda"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filtro ? "Tente outro nome" : "Cadastre onde você pesquisa preços"}
                  </p>
                </div>
              </div>
            )}

            {lista.map(l => (
              <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{l.nome}</p>
                    {l.tipoComercio && <p className="text-xs text-muted-foreground">{l.tipoComercio}</p>}
                    {l.endereco && <p className="text-xs text-muted-foreground truncate mt-0.5">{l.endereco}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        Desl. {parseFloat(String(l.custoOperacionalPadrao ?? "0")).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      {l.lat && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Navigation className="h-3 w-3" /> GPS
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(l)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 active:bg-gray-200">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-red-50 active:bg-red-100">
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover "{l.nome}"?</AlertDialogTitle>
                          <AlertDialogDescription>O local será desativado. Histórico de preços mantido.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => remover.mutate({ id: l.id })}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAB */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-gray-50 to-transparent">
          <button onClick={openNew} className="w-full h-14 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-transform text-base">
            <Plus className="h-5 w-5" /> Novo Local
          </button>
        </div>
      </div>

      {/* Bottom Sheet criar/editar */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-white rounded-t-3xl max-w-md mx-auto w-full max-h-[85svh] flex flex-col shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 bg-gray-200 rounded-full" />
            </div>
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="font-bold text-base">{form.id ? "Editar local" : "Novo local"}</h2>
              <button onClick={close} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Formulário */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <Field label="Nome *">
                <input autoFocus className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: Atacadão Asa Norte" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </Field>

              <Field label="Tipo de comércio">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TIPOS.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, tipoComercio: f.tipoComercio === t ? "" : t }))}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.tipoComercio === t ? "bg-primary text-white border-primary" : "border-gray-200 text-muted-foreground hover:border-primary/50"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Endereço">
                <input className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Rua, número, bairro" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
              </Field>

              <Field label="Custo de deslocamento (R$)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <input type="number" min="0" step="0.5" className="w-full text-sm bg-gray-50 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30" placeholder="0,00" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} />
                </div>
              </Field>

              <Field label="Coordenadas GPS">
                <div className="flex gap-2">
                  <input className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none" placeholder="Latitude" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                  <input className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none" placeholder="Longitude" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
                  <button onClick={captureGPS} disabled={gps} className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center active:bg-primary/20 disabled:opacity-50">
                    <Navigation className={`h-4 w-4 ${gps ? "animate-pulse" : ""}`} />
                  </button>
                </div>
              </Field>
            </div>
            {/* Botão salvar */}
            <div className="px-5 pb-8 pt-3 border-t border-gray-100">
              <button onClick={save} disabled={saving} className="w-full h-13 py-3.5 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50">
                {saving ? "Salvando..." : <><Check className="h-5 w-5" />{form.id ? "Salvar" : "Cadastrar"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
