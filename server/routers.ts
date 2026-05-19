/**
 * server/routers.ts
 *
 * CHANGELOG v13:
 * 1. paymentSettingsSchema expandido com Fiscal, Boleto, Cartão e Descontos Universais.
 * 2. taxCash (PIX) removido do paymentSettingsSchema — forçado como 0 no db.payment-settings.ts.
 * 3. Todos os outros procedimentos INTACTOS.
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
import * as dbOrders from "./db.orders";
import * as dbSettings from "./db.settings";
import * as dbPayment from "./db.payment-settings";

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
  taxCash: z.number().min(0).optional(),
  taxBoleto: z.number().min(0).optional(),
  taxDebit: z.number().min(0).optional(),
  taxCreditCash: z.number().min(0).optional(),
  taxCreditInstallment: z.number().min(0).optional(),
  boletoMonths: z.number().min(1).optional(),
  boletoMonthlyRate: z.number().min(0).optional(),
  boletoFixedFee: z.number().min(0).optional(),
  boletoDefaultRisk: z.number().min(0).optional(),
  boletoCustomerPaysInterest: z.boolean().optional(),
  cardDebitFee: z.number().min(0).optional(),
  cardCreditCashFee: z.number().min(0).optional(),
  cardCreditInstallmentFee: z.number().min(0).optional(),
  cardInstallments: z.number().min(1).optional(),
  cardAnticipationRate: z.number().min(0).optional(),
  cardMonthlyRate: z.number().min(0).optional(),
  cardCustomerPaysInterest: z.boolean().optional(),
});

const batchItemSchema = z.object({
  productId: z.number().optional(),
  productName: z.string().min(1),
  unitCostBrl: z.number().min(0),
  quantity: z.number().int().min(1),
  desiredMarginRate: z.number().min(0).max(99.9),
  estimatedTaxRate: z.number().min(0).max(99.9).optional(),
});

const pricingDefaultsSchema = z.object({
  taxRegime: z.string().optional(),
  taxCash: z.string().optional(),
  taxBoleto: z.string().optional(),
  taxDebit: z.string().optional(),
  taxCreditCash: z.string().optional(),
  taxCreditInstallment: z.string().optional(),
  boletoMonths: z.string().optional(),
  boletoMonthlyRate: z.string().optional(),
  boletoFixedFee: z.string().optional(),
  boletoDefaultRisk: z.string().optional(),
  boletoCustomerPaysInterest: z.boolean().optional(),
  cardDebitFee: z.string().optional(),
  cardCreditCashFee: z.string().optional(),
  cardCreditInstallmentFee: z.string().optional(),
  cardInstallments: z.string().optional(),
  cardAnticipationRate: z.string().optional(),
  cardMonthlyRate: z.string().optional(),
  cardCustomerPaysInterest: z.boolean().optional(),
});

// ─── paymentSettingsSchema — EXPANDIDO (v13) ──────────────────────────────────
// taxCash (PIX) AUSENTE — forçado como 0 no db.payment-settings.ts.
// Todos os campos são opcionais para permitir PATCH parcial.

const paymentSettingsSchema = z.object({
  // Fiscal
  taxRegime: z
    .enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MANUAL"])
    .optional(),
  taxBoleto: z.number().min(0).max(100).optional(),
  taxDebit: z.number().min(0).max(100).optional(),
  taxCreditCash: z.number().min(0).max(100).optional(),
  taxCreditInstallment: z.number().min(0).max(100).optional(),

  // Cartão
  cardDebitFee: z.number().min(0).max(100).optional(),
  cardCreditCashFee: z.number().min(0).max(100).optional(),
  cardCreditInstallmentFee: z.number().min(0).max(100).optional(),
  cardInstallments: z.number().min(1).max(48).optional(),
  cardAnticipationRate: z.number().min(0).max(100).optional(),
  cardMonthlyRate: z.number().min(0).max(100).optional(),
  cardCustomerPaysInterest: z.boolean().optional(),

  // Boleto
  boletoMonths: z.number().min(1).max(60).optional(),
  boletoMonthlyRate: z.number().min(0).max(100).optional(),
  boletoFixedFee: z.number().min(0).optional(),
  boletoDefaultRisk: z.number().min(0).max(100).optional(),
  boletoCustomerPaysInterest: z.boolean().optional(),

  // Descontos universais (% sobre preço final ao cliente)
  discountPix: z.number().min(0).max(100).optional(),
  discountCash: z.number().min(0).max(100).optional(),
  discountBoleto: z.number().min(0).max(100).optional(),
  discountDebit: z.number().min(0).max(100).optional(),
  discountCredit: z.number().min(0).max(100).optional(),

  // Legado (mantido para compatibilidade)
  cashDiscountPercent: z.number().min(0).max(100).optional(),

  // Links e plataforma globais (defaults para novos produtos)
  paymentPlatform: z.enum(["MERCADO_PAGO", "PAGSEGURO", "OUTRO"]).optional(),
  pixKey: z.string().optional().nullable(),
  pixLink: z.string().optional().nullable(),
  cardPaymentUrl: z.string().optional().nullable(),
  boletoUrl: z.string().optional().nullable(),
});

// ─── Router principal ─────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  // ── Configurações globais de precificação (defaults) ───────────────────────
  settings: router({
    getPricingDefaults: publicProcedure.query(() =>
      dbSettings.getPricingDefaults()
    ),
    updatePricingDefaults: protectedProcedure
      .input(pricingDefaultsSchema)
      .mutation(({ input }) => dbSettings.updatePricingDefaults(input)),
  }),

  // ── Configurações de pagamento (centralizadas, travadas) ───────────────────
  paymentSettings: router({
    get: publicProcedure.query(() => dbPayment.getPaymentSettings()),
    update: protectedProcedure
      .input(paymentSettingsSchema)
      .mutation(({ input }) => dbPayment.updatePaymentSettings(input)),
  }),

  // ── Produtos ───────────────────────────────────────────────────────────────
  products: router({
    create: protectedProcedure
      .input(productInput)
      .mutation(({ input, ctx }) =>
        db.createProduct({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(() => db.listProducts()),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getProductById(input.id)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: productInput.partial() }))
      .mutation(({ input }) => db.updateProduct(input.id, input.data)),

    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deactivateProduct(input.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteProduct(input.id)),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.duplicateProduct(input.id)),

    getImages: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => dbImages.getProductImages(input.productId)),

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

    setThumbnail: protectedProcedure
      .input(z.object({ imageId: z.number(), productId: z.number() }))
      .mutation(({ input, ctx }) =>
        dbImages.setThumbnail(input.imageId, input.productId, ctx.user.id)
      ),

    reorderImages: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          orderedIds: z.array(z.number()),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.reorderProductImages(input.productId, ctx.user.id, input.orderedIds)
      ),

    deleteImage: protectedProcedure
      .input(z.object({ imageId: z.number(), productId: z.number() }))
      .mutation(({ input, ctx }) =>
        dbImages.deleteProductImageRecord(input.imageId, input.productId, ctx.user.id)
      ),

    updateImageAlt: protectedProcedure
      .input(
        z.object({
          imageId: z.number(),
          productId: z.number(),
          altText: z.string(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.updateImageAltText(input.imageId, input.productId, ctx.user.id, input.altText)
      ),

    setImageUrl: protectedProcedure
      .input(z.object({ productId: z.number(), imageUrl: z.string().url() }))
      .mutation(({ input, ctx }) =>
        dbBatches.updateProductImage(input.productId, ctx.user.id, input.imageUrl)
      ),

    reorder: protectedProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(({ input }) => db.reorderProducts(input.orderedIds)),

    togglePublished: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          published: z.boolean(),
          promoTag: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.togglePublished(input.productId, ctx.user.id, input.published, input.promoTag)
      ),

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
        dbBatches.adjustStock(input.productId, ctx.user.id, input.quantity, input.unitCost, input.notes)
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

    list: protectedProcedure.query(() => dbBatches.listBatches()),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => dbBatches.getBatchById(input.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => dbBatches.deleteBatch(input.id)),

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
    products: publicProcedure.query(() => dbBatches.getPublishedProducts()),
    productsByCategory: publicProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(({ input }) => dbBatches.getPublishedProductsByCategory(input.category)),
    productById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => dbBatches.getPublishedProductById(input.id)),
  }),

  // ── Simulações ─────────────────────────────────────────────────────────────
  simulations: router({
    create: protectedProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        db.createSimulation({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(() => db.listSimulations()),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getSimulationById(input.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteSimulation(input.id)),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.duplicateSimulation(input.id)),
  }),

  // ── Lista de Desejos ──────────────────────────────────────────────────────
  wishlist: router({
    create: publicProcedure
      .input(
        z.object({
          visitorName: z.string().min(2),
          contact: z.string().min(8),
          contactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
          // Campos novos v2
          productIds: z.array(z.number().int().positive()).min(1),
          notesPublic: z.string().max(300).optional(),
          // Campos legados opcionais (compatibilidade com código existente)
          category: z
            .enum(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"])
            .optional(),
          brand: z.string().optional(),
          model: z.string().optional(),
          description: z.string().optional(),
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
        // Garante description não-null para schema legado
        const description = input.description ?? "";
        return dbWishlist.createWishlistRequest({ ...input, description, ipHash });
      }),

    myRequests: publicProcedure
      .input(z.object({
        contact: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
      }))
      .query(({ input }) => {
        const lookup = input.phone ?? input.contact ?? "";
        return dbWishlist.getWishlistByContact(lookup);
      }),

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

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["NOVO", "VISUALIZADO", "CONTATADO", "ATENDIDO", "FECHADO"]),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbWishlist.updateWishlistStatus(input.id, input.status, input.adminNotes, ctx.user.id)
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => dbWishlist.deleteWishlistRequest(input.id)),

    counts: protectedProcedure.query(() => dbWishlist.getWishlistCounts()),
  }),

  // ── Categorias ─────────────────────────────────────────────────────────────
  categories: router({
    list: publicProcedure
      .input(z.object({ onlyActive: z.boolean().default(false) }).optional())
      .query(({ input }) => dbWishlist.listCategories(input?.onlyActive)),

    create: protectedProcedure
      .input(
        z.object({
          slug: z.string().min(2).max(50),
          label: z.string().min(2).max(100),
          emoji: z.string().max(10).default("📦"),
          sortOrder: z.number().int().default(0),
          active: z.boolean().default(true),
        })
      )
      .mutation(({ input }) => dbWishlist.createCategory(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          slug: z.string().min(2).max(50).optional(),
          label: z.string().min(2).max(100).optional(),
          emoji: z.string().max(10).optional(),
          sortOrder: z.number().int().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return dbWishlist.updateCategory(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ input }) => dbWishlist.deleteCategory(input.id)),
  }),

  // ── Pedidos ────────────────────────────────────────────────────────────────
  orders: router({
    create: publicProcedure
      .input(
        z.object({
          productId: z.number(),
          quantity: z.number().int().min(1).default(1),
          buyerName: z.string().min(2, "Informe seu nome"),
          buyerContact: z.string().min(8, "Informe WhatsApp ou email"),
          buyerContactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
          paymentMethod: z.enum(["PIX", "CARTAO", "BOLETO"]),
          unitPrice: z.number().min(0),
        })
      )
      .mutation(({ input }) => dbOrders.createOrder(input)),

    list: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum([
                "AGUARDANDO_PAGAMENTO",
                "RESERVADO",
                "PAGO",
                "CANCELADO",
                "EXPIRADO",
              ])
              .optional(),
            productId: z.number().optional(),
          })
          .optional()
      )
      .query(({ input }) => dbOrders.listOrders(input)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => dbOrders.getOrderById(input.id)),

    confirm: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbOrders.confirmOrder(input.orderId, ctx.user.id, input.adminNotes)
      ),

    cancel: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        dbOrders.cancelOrder(input.orderId, input.adminNotes)
      ),

    expireStale: protectedProcedure.mutation(() =>
      dbOrders.expireStaleReservations()
    ),

    counts: protectedProcedure.query(() => dbOrders.getOrderCounts()),
  }),

  // ── Dashboard ─────────────────────────────────────────────────────────────
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

  // ── Admin ──────────────────────────────────────────────────────────────────
  admin: router({
    listUsers: protectedProcedure.query(async () => {
      const dbConn = await db.getDb();
      if (!dbConn) return [];
      const { users } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return dbConn
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          active: users.active,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .orderBy(desc(users.createdAt));
    }),

    createUser: protectedProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().min(2),
          password: z.string().min(8),
          role: z.enum(["user", "admin"]).default("user"),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");
        return db.createUser(input);
      }),

    updateUserRole: protectedProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id)
          throw new Error("Não é possível alterar seu próprio papel");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [updated] = await dbConn
          .update(users)
          .set({ role: input.role, updatedAt: new Date() })
          .where(eq(users.id, input.userId))
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            active: users.active,
          });
        return updated;
      }),

    toggleUserActive: protectedProcedure
      .input(z.object({ userId: z.number(), active: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id)
          throw new Error("Não é possível desativar sua própria conta");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [updated] = await dbConn
          .update(users)
          .set({ active: input.active, updatedAt: new Date() })
          .where(eq(users.id, input.userId))
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            active: users.active,
          });
        return updated;
      }),

    resetUserPassword: protectedProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(input.newPassword, 12);
        await dbConn
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return db.deleteUser(input.userId, ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
