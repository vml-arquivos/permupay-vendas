/**
 * client/src/pages/CotacaoSessaoForm.tsx
 *
 * Criação e edição de sessão de cotação (lista de produtos + metadados).
 */

import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  GripVertical,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ProdutoSelecionado {
  produtoId: number;
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  obrigatorio: boolean;
  ordem: number;
}

export default function CotacaoSessaoForm() {
  const params = useParams<{ id?: string }>();
  const sessaoId = params.id ? Number(params.id) : null;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Form state
  const [titulo, setTitulo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [produtos, setProdutos] = useState<ProdutoSelecionado[]>([]);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");

  // Dados do servidor
  const { data: todosOsProdutos, isLoading: loadingProdutos } =
    trpc.products.list.useQuery();
  const { data: sessaoExistente, isLoading: loadingSessao } =
    trpc.cotacao.sessoes.obter.useQuery(
      { id: sessaoId! },
      { enabled: !!sessaoId }
    );

  // Preencher form ao editar
  useEffect(() => {
    if (sessaoExistente) {
      setTitulo(sessaoExistente.titulo);
      setObservacao(sessaoExistente.observacao ?? "");
      setProdutos(
        sessaoExistente.produtos.map((p) => ({
          produtoId: p.produtoId,
          nome: p.produtoNome,
          categoria: p.produtoCategoria,
          quantidade: parseFloat(String(p.quantidade)),
          unidade: p.unidade ?? "un",
          obrigatorio: p.obrigatorio,
          ordem: p.ordem,
        }))
      );
    }
  }, [sessaoExistente]);

  const criarSessao = trpc.cotacao.sessoes.criar.useMutation({
    onSuccess: (data) => {
      utils.cotacao.sessoes.listar.invalidate();
      toast.success("Sessão criada! Agora colete os preços.");
      navigate(`/cotacoes/${data.id}/coletar`);
    },
    onError: (err) => toast.error(err.message),
  });

  const atualizarSessao = trpc.cotacao.sessoes.atualizar.useMutation({
    onSuccess: () => {
      utils.cotacao.sessoes.listar.invalidate();
      toast.success("Sessão atualizada");
      navigate("/cotacoes");
    },
    onError: (err) => toast.error(err.message),
  });

  const produtosFiltrados =
    todosOsProdutos?.filter(
      (p) =>
        !produtos.find((sp) => sp.produtoId === p.id) &&
        p.name.toLowerCase().includes(buscaProduto.toLowerCase())
    ) ?? [];

  function adicionarProduto(prod: {
    id: number;
    name: string;
    category: string;
  }) {
    setProdutos((prev) => [
      ...prev,
      {
        produtoId: prod.id,
        nome: prod.name,
        categoria: prod.category,
        quantidade: 1,
        unidade: "un",
        obrigatorio: false,
        ordem: prev.length,
      },
    ]);
    setBuscaAberta(false);
    setBuscaProduto("");
  }

  function removerProduto(idx: number) {
    setProdutos((prev) => prev.filter((_, i) => i !== idx));
  }

  function atualizarProduto(idx: number, field: string, value: any) {
    setProdutos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  }

  function handleSubmit() {
    if (!titulo.trim()) {
      toast.error("Informe um título para a cotação");
      return;
    }
    if (produtos.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    if (sessaoId) {
      atualizarSessao.mutate({
        id: sessaoId,
        titulo,
        observacao: observacao || undefined,
      });
    } else {
      criarSessao.mutate({
        titulo,
        observacao: observacao || undefined,
        produtos: produtos.map((p, i) => ({
          produtoId: p.produtoId,
          quantidade: p.quantidade,
          unidade: p.unidade,
          obrigatorio: p.obrigatorio,
          ordem: i,
        })),
      });
    }
  }

  const isLoading = sessaoId ? loadingSessao : false;
  const isSaving = criarSessao.isPending || atualizarSessao.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/cotacoes")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              {sessaoId ? "Editar Sessão" : "Nova Sessão de Cotação"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {sessaoId
                ? "Atualize os dados da sessão"
                : "Defina os produtos que serão pesquisados"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {/* Dados básicos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="titulo">Título da cotação *</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: Compras semanais — Atacado"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="obs">Observação</Label>
                  <Textarea
                    id="obs"
                    placeholder="Contexto adicional..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="mt-1 resize-none"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Produtos (apenas na criação ou visualização) */}
            {!sessaoId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    Produtos a pesquisar
                    {produtos.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {produtos.length}
                      </Badge>
                    )}
                  </CardTitle>

                  <Popover open={buscaAberta} onOpenChange={setBuscaAberta}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Search className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-80" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Buscar produto..."
                          value={buscaProduto}
                          onValueChange={setBuscaProduto}
                        />
                        {loadingProdutos ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Carregando...
                          </div>
                        ) : (
                          <CommandGroup>
                            <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                            {produtosFiltrados.slice(0, 20).map((p) => (
                              <CommandItem
                                key={p.id}
                                onSelect={() => adicionarProduto(p)}
                                className="cursor-pointer"
                              >
                                <div>
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {p.category}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>
                </CardHeader>
                <CardContent>
                  {produtos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Plus className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">
                        Adicione produtos para pesquisar os preços
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {produtos.map((p, i) => (
                        <div
                          key={p.produtoId}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {p.nome}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.categoria}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="number"
                              min="0.001"
                              step="0.5"
                              value={p.quantidade}
                              onChange={(e) =>
                                atualizarProduto(
                                  i,
                                  "quantidade",
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              className="w-16 h-7 text-sm text-center"
                            />
                            <Input
                              value={p.unidade}
                              onChange={(e) =>
                                atualizarProduto(i, "unidade", e.target.value)
                              }
                              className="w-14 h-7 text-sm"
                              placeholder="un"
                            />
                            <div className="flex items-center gap-1">
                              <Checkbox
                                id={`obrig-${i}`}
                                checked={p.obrigatorio}
                                onCheckedChange={(v) =>
                                  atualizarProduto(i, "obrigatorio", !!v)
                                }
                              />
                              <Label
                                htmlFor={`obrig-${i}`}
                                className="text-xs text-muted-foreground cursor-pointer"
                                title="Produto obrigatório — se não encontrado, o local é desqualificado"
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                              </Label>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removerProduto(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Marque o ícone para tornar um produto obrigatório —
                        locais que não tiverem o produto serão desqualificados do
                        ranking
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ações */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => navigate("/cotacoes")}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving
                  ? "Salvando..."
                  : sessaoId
                  ? "Salvar alterações"
                  : "Criar e iniciar coleta"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
