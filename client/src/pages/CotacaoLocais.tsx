/**
 * client/src/pages/CotacaoLocais.tsx
 *
 * CRUD de locais/comércios onde os preços são pesquisados.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Store,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";

interface LocalForm {
  id?: number;
  nome: string;
  endereco: string;
  tipoComercio: string;
  custoOperacionalPadrao: string;
  lat: string;
  lng: string;
}

const DEFAULT_FORM: LocalForm = {
  nome: "",
  endereco: "",
  tipoComercio: "",
  custoOperacionalPadrao: "0",
  lat: "",
  lng: "",
};

const TIPOS = [
  "Supermercado",
  "Atacado",
  "Feira",
  "Hortifrúti",
  "Açougue",
  "Padaria",
  "Farmácia",
  "Mercearia",
  "Outro",
];

export default function CotacaoLocais() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<LocalForm>(DEFAULT_FORM);
  const [capturandoGPS, setCapturandoGPS] = useState(false);

  const { data: locais, isLoading } = trpc.cotacao.locais.listar.useQuery();

  const criar = trpc.cotacao.locais.criar.useMutation({
    onSuccess: () => {
      utils.cotacao.locais.listar.invalidate();
      setDialogAberto(false);
      setForm(DEFAULT_FORM);
      toast.success("Local cadastrado");
    },
    onError: (err) => toast.error(err.message),
  });

  const atualizar = trpc.cotacao.locais.atualizar.useMutation({
    onSuccess: () => {
      utils.cotacao.locais.listar.invalidate();
      setDialogAberto(false);
      setForm(DEFAULT_FORM);
      toast.success("Local atualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  const remover = trpc.cotacao.locais.remover.useMutation({
    onSuccess: () => {
      utils.cotacao.locais.listar.invalidate();
      toast.success("Local removido");
    },
    onError: (err) => toast.error(err.message),
  });

  function abrirCriar() {
    setForm(DEFAULT_FORM);
    setDialogAberto(true);
  }

  function abrirEditar(local: any) {
    setForm({
      id: local.id,
      nome: local.nome,
      endereco: local.endereco ?? "",
      tipoComercio: local.tipoComercio ?? "",
      custoOperacionalPadrao: local.custoOperacionalPadrao ?? "0",
      lat: local.lat ?? "",
      lng: local.lng ?? "",
    });
    setDialogAberto(true);
  }

  function capturarGPS() {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível neste dispositivo");
      return;
    }
    setCapturandoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: String(pos.coords.latitude.toFixed(8)),
          lng: String(pos.coords.longitude.toFixed(8)),
        }));
        setCapturandoGPS(false);
        toast.success("Coordenadas capturadas!");
      },
      (err) => {
        setCapturandoGPS(false);
        toast.error("Não foi possível obter a localização: " + err.message);
      }
    );
  }

  function handleSalvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do local");
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      endereco: form.endereco || undefined,
      tipoComercio: form.tipoComercio || undefined,
      custoOperacionalPadrao: form.custoOperacionalPadrao || "0",
      lat: form.lat || undefined,
      lng: form.lng || undefined,
    };

    if (form.id) {
      atualizar.mutate({ id: form.id, ...payload });
    } else {
      criar.mutate(payload);
    }
  }

  const isSaving = criar.isPending || atualizar.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/cotacoes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Locais de Pesquisa
              </h1>
              <p className="text-sm text-muted-foreground">
                Comércios onde você pesquisa preços
              </p>
            </div>
          </div>
          <Button onClick={abrirCriar}>
            <Plus className="h-4 w-4 mr-2" />
            Novo local
          </Button>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !locais || locais.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground border-2 border-dashed rounded-xl">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum local ainda</p>
            <p className="text-sm mt-1 mb-4">
              Cadastre os locais onde você pesquisa preços
            </p>
            <Button variant="outline" onClick={abrirCriar}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar primeiro local
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {locais.map((local) => (
              <Card key={local.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{local.nome}</div>
                      {local.tipoComercio && (
                        <div className="text-xs text-muted-foreground">
                          {local.tipoComercio}
                        </div>
                      )}
                      {local.endereco && (
                        <div className="text-sm text-muted-foreground mt-0.5 truncate">
                          {local.endereco}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Custo deslocamento:{" "}
                        <span className="font-medium">
                          {parseFloat(
                            String(local.custoOperacionalPadrao ?? "0")
                          ).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                        {local.lat && (
                          <span className="ml-2">
                            · GPS: {local.lat}, {local.lng}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => abrirEditar(local)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover local?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O local será desativado. Os dados de cotação já
                              coletados serão mantidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => remover.mutate({ id: local.id })}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar local" : "Novo local"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Ex: Atacadão do Plano Piloto"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tipo">Tipo de comércio</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="tipo"
                  placeholder="Ex: Supermercado"
                  value={form.tipoComercio}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tipoComercio: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.tipoComercio === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent"
                    }`}
                    onClick={() =>
                      setForm((p) => ({ ...p, tipoComercio: t }))
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                placeholder="Rua, número, bairro"
                value={form.endereco}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endereco: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="custo">Custo de deslocamento (R$)</Label>
              <Input
                id="custo"
                type="number"
                min="0"
                step="0.50"
                placeholder="0,00"
                value={form.custoOperacionalPadrao}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    custoOperacionalPadrao: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Coordenadas GPS</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={capturarGPS}
                  disabled={capturandoGPS}
                  className="h-7 text-xs"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  {capturandoGPS ? "Capturando..." : "Capturar atual"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  placeholder="Latitude"
                  value={form.lat}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, lat: e.target.value }))
                  }
                />
                <Input
                  placeholder="Longitude"
                  value={form.lng}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, lng: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogAberto(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={isSaving}>
              {isSaving ? "Salvando..." : form.id ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
