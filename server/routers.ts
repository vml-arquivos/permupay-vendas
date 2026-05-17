/**
 * routers.ts — Router tRPC completo
 *
 * Substitui server/routers.ts existente.
 * Adiciona: batches, marketplace, image upload (presigned URL)
 */

import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import * as dbBatches from "./db.batches";
import * as dbWishlist from "./db.wishlist";
import * as dbImages from "./db.images";
// Upload de imagens agora é feito via POST /api/upload/product-image (server/index.ts)

// ─── Schemas reutilizáveis ────────────────────────────────────────────────────

const productInput = z.object({
  name: z.string().min(1),
  category: z.enum(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"]),
  ncm: z.string().optional(),
  costPrice: z.number().min(0),
  packagingCost: z.number().min(0),
  inboundShippingCost: z.number().min(0),
  operationalCost: z.number().min(0),
  desiredMarginRate: z.number().min(0),
  desiredMarginValue: z.number().min(0).optional(),
  marginMode: z.enum(["PERCENT", "VALUE"]).optional(),
  taxRegime: z.enum([
    "SIMPLES_NACIONAL",
    "LUCRO_PRESUMIDO",
    "LUCRO_REAL",
    "MANUAL",
  ]),
  estimatedTaxRate: z.number().min(0),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  costCurrency: z.enum(["BRL", "USD"]).optional(),
  costPriceUsd: z.number().min(0).optional(),
  usdExchangeRate: z.number().min(0).optional(),
  stockQuantity: z.number().min(0).optional(),
  minimumStock: z.number().min(0).optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  suggestedPrice: z.number().min(0).optional(),
  suggestedPricePix: z.number().min(0).optional(),
  suggestedPriceCard: z.number().min(0).optional(),
  suggestedPriceBoleto: z.number().min(0).optional(),
  paymentPlatform: z.enum(["MERCADO_PAGO", "PAGSEGURO", "OUTRO"]).optional(),
  pixKey: z.string().optional(),
  pixLink: z.string().optional(),
  cardPaymentUrl: z.string().optional(),
  boletoUrl: z.string().optional(),
  categoryLabel: z.string().optional(),
  promoTag: z.string().optional(),
  published: z.boolean().optional(),
});

const batchItemSchema = z.object({
  productId: z.number().optional(),
  productName: z.string().min(1),
  unitCostBrl: z.number().min(0),
  quantity: z.number().int().min(1),
  desiredMarginRate: z.number().min(0).max(99.9),
  estimatedTaxRate: z.number().min(0).max(99.9).optional(),
});

// ─── Router principal ─────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  // ── Produtos ───────────────────────────────────────────────────────────────
  products: router({
    create: protectedProcedure
      .input(productInput)
      .mutation(({ input, ctx }) =>
        db.createProduct({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(({ ctx }) =>
      db.listProducts(ctx.user.id)
    ),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) => db.getProductById(input.id, ctx.user.id)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: productInput.partial() }))
      .mutation(({ input, ctx }) =>
        db.updateProduct(input.id, input.data, ctx.user.id)
      ),

    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input, ctx }) =>
        db.deactivateProduct(input.id, ctx.user.id)
      ),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input, ctx }) =>
        db.duplicateProduct(input.id, ctx.user.id)
      ),

    // ── Galeria de imagens ────────────────────────────────────────────────────
    // Upload: POST /api/upload/product-image (ver server/_core/index.ts)

    // Listar imagens da galeria de um produto
    getImages: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => dbImages.getProductImages(input.productId)),

    // Registrar imagem após upload direto no S3 (presigned URL)
    addImage: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          url: z.string().url(),
          storageKey: z.string().optional(),
          altText: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.addProductImage(input.productId, ctx.user.id, {
          url: input.url,
          storageKey: input.storageKey,
          altText: input.altText,
        })
      ),

    // Definir thumbnail da galeria
    setThumbnail: protectedProcedure
      .input(
        z.object({
          imageId: z.number(),
          productId: z.number(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.setThumbnail(input.imageId, input.productId, ctx.user.id)
      ),

    // Reordenar imagens da galeria
    reorderImages: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          orderedIds: z.array(z.number()),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.reorderProductImages(
          input.productId,
          ctx.user.id,
          input.orderedIds
        )
      ),

    // Deletar imagem da galeria (banco + S3)
    deleteImage: protectedProcedure
      .input(
        z.object({
          imageId: z.number(),
          productId: z.number(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.deleteProductImageRecord(
          input.imageId,
          input.productId,
          ctx.user.id
        )
      ),

    // Atualizar texto alternativo de uma imagem
    updateImageAlt: protectedProcedure
      .input(
        z.object({
          imageId: z.number(),
          productId: z.number(),
          altText: z.string(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.updateImageAltText(
          input.imageId,
          input.productId,
          ctx.user.id,
          input.altText
        )
      ),

    // Após o browser fazer o upload, salvar a URL pública no produto (legado)
    setImageUrl: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          imageUrl: z.string().url(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.updateProductImage(
          input.productId,
          ctx.user.id,
          input.imageUrl
        )
      ),

    // Publicar/despublicar na vitrine
    togglePublished: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          published: z.boolean(),
          promoTag: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.togglePublished(
          input.productId,
          ctx.user.id,
          input.published,
          input.promoTag
        )
      ),

    // Ajuste manual de estoque
    adjustStock: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          quantity: z.number(),
          unitCost: z.number().min(0),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.adjustStock(
          input.productId,
          ctx.user.id,
          input.quantity,
          input.unitCost,
          input.notes
        )
      ),

    stockEntries: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => dbBatches.getStockEntries(input.productId)),
  }),

  // ── Lotes de Precificação ──────────────────────────────────────────────────
  batches: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          totalOperationalCost: z.number().min(0),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.createBatch({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(({ ctx }) =>
      dbBatches.listBatches(ctx.user.id)
    ),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) =>
        dbBatches.getBatchById(input.id, ctx.user.id)
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input, ctx }) =>
        dbBatches.deleteBatch(input.id, ctx.user.id)
      ),

    /**
     * Processa o rateio dos itens do lote.
     * Se commitToStock=true, dá entrada no estoque e fecha o lote.
     */
    process: protectedProcedure
      .input(
        z.object({
          batchId: z.number(),
          items: z.array(batchItemSchema).min(1),
          totalOperationalCost: z.number().min(0),
          commitToStock: z.boolean().default(false),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.processBatch(
          input.batchId,
          ctx.user.id,
          input.items,
          input.totalOperationalCost,
          input.commitToStock
        )
      ),
  }),

  // ── Marketplace / Vitrine pública ──────────────────────────────────────────
  marketplace: router({
    /** Rota pública — não requer autenticação */
    products: publicProcedure.query(() => dbBatches.getPublishedProducts()),
    productsByCategory: publicProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(({ input }) => dbBatches.getPublishedProductsByCategory(input.category)),
  }),

  // ── Simulações ─────────────────────────────────────────────────────────────
  simulations: router({
    create: protectedProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        db.createSimulation({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(({ ctx }) =>
      db.listSimulations(ctx.user.id)
    ),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) =>
        db.getSimulationById(input.id, ctx.user.id)
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input, ctx }) =>
        db.deleteSimulation(input.id, ctx.user.id)
      ),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input, ctx }) =>
        db.duplicateSimulation(input.id, ctx.user.id)
      ),
  }),

  // ── Dashboard ───────────────────────────────────────────────────────────────
  // ── Lista de Desejos ──────────────────────────────────────────────────────────
  wishlist: router({
    // Público: criar um desejo
    create: publicProcedure
      .input(
        z.object({
          visitorName: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
          contact: z.string().min(8, "Informe WhatsApp ou email"),
          contactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
          category: z.enum(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"]).optional(),
          brand: z.string().optional(),
          model: z.string().optional(),
          description: z.string().min(10, "Descreva melhor o que procura (mín. 10 caracteres)"),
          budgetMin: z.number().min(0).default(0),
          budgetMax: z.number().min(0).default(0),
          isAnonymous: z.boolean().default(false),
        })
      )
      .mutation(({ input, ctx }) => {
        const ipRaw =
          (ctx.req.headers["x-forwarded-for"] as string | undefined) ??
          (ctx.req as any).ip ??
          "";
        const ipHash = ipRaw
          ? Buffer.from(ipRaw).toString("base64").slice(0, 16)
          : undefined;
        return dbWishlist.createWishlistRequest({ ...input, ipHash });
      }),

    // Público: listar os próprios desejos pelo contato
    myRequests: publicProcedure
      .input(z.object({ contact: z.string().min(1) }))
      .query(({ input }) => dbWishlist.getWishlistByContact(input.contact)),

    // Admin: listar todos com filtros
    list: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum(["NOVO", "VISUALIZADO", "CONTATADO", "ATENDIDO", "FECHADO"])
              .optional(),
            category: z.string().optional(),
          })
          .optional()
      )
      .query(({ input }) => dbWishlist.listWishlistRequests(input)),

    // Admin: atualizar status
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["NOVO", "VISUALIZADO", "CONTATADO", "ATENDIDO", "FECHADO"]),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbWishlist.updateWishlistStatus(
          input.id,
          input.status,
          input.adminNotes,
          ctx.user.id
        )
      ),

    // Admin: deletar
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => dbWishlist.deleteWishlistRequest(input.id)),

    // Admin/Dashboard: contadores
    counts: protectedProcedure.query(() => dbWishlist.getWishlistCounts()),
  }),

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [dashData, wishlistCounts] = await Promise.all([
      db.getDashboardData(ctx.user.id),
      dbWishlist.getWishlistCounts(),
    ]);
    return { ...dashData, wishlistCounts };
  }),

  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(1, "Senha obrigatória"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.active) throw new Error("Credenciais inválidas");

        const valid = await db.verifyPassword(user, input.password);
        if (!valid) throw new Error("Credenciais inválidas");

        await db.updateLastSignedIn(user.id);

        const token = await sdk.createSessionToken({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true as const, user: db.toSafeUser(user) };
      }),

    register: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
          name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");

        const totalUsers = await db.countUsers();
        const role: "admin" | "user" = totalUsers === 0 ? "admin" : "user";

        const user = await db.createUser({
          email: input.email,
          password: input.password,
          name: input.name,
          role,
        });

        const token = await sdk.createSessionToken({
          userId: (user as any).id,
          email: user.email,
          name: user.name,
          role: user.role,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true as const, user };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
