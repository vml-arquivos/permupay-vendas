import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";



const productInput = z.object({name:z.string().min(1),category:z.enum(["CELULAR","ELETRONICO","PERFUME","OUTRO"]),ncm:z.string().optional(),costPrice:z.number().min(0),packagingCost:z.number().min(0),inboundShippingCost:z.number().min(0),operationalCost:z.number().min(0),desiredMarginRate:z.number().min(0),taxRegime:z.enum(["SIMPLES_NACIONAL","LUCRO_PRESUMIDO","LUCRO_REAL","MANUAL"]),estimatedTaxRate:z.number().min(0),notes:z.string().optional(),active:z.boolean().optional(),costCurrency:z.enum(["BRL","USD"]).optional(),costPriceUsd:z.number().min(0).optional(),usdExchangeRate:z.number().min(0).optional(),stockQuantity:z.number().min(0).optional(),minimumStock:z.number().min(0).optional()});

export const appRouter = router({
  system: systemRouter,


  products: router({
    create: protectedProcedure.input(productInput).mutation(({input,ctx})=>db.createProduct({...input,userId:ctx.user.id})),
    list: protectedProcedure.query(({ctx}) => db.listProducts(ctx.user.id)),
    byId: protectedProcedure.input(z.object({id:z.number()})).query(({input,ctx})=>db.getProductById(input.id, ctx.user.id)),
    update: protectedProcedure.input(z.object({id:z.number(),data:productInput.partial()})).mutation(({input,ctx})=>db.updateProduct(input.id,input.data,ctx.user.id)),
    deactivate: protectedProcedure.input(z.object({id:z.number()})).mutation(({input,ctx})=>db.deactivateProduct(input.id,ctx.user.id)),
    duplicate: protectedProcedure.input(z.object({id:z.number()})).mutation(({input,ctx})=>db.duplicateProduct(input.id,ctx.user.id)),
  }),
  simulations: router({
    create: protectedProcedure.input(z.any()).mutation(({ input, ctx }) => db.createSimulation({...input,userId:ctx.user.id})),
    list: protectedProcedure.query(({ctx})=>db.listSimulations(ctx.user.id)),
    byId: protectedProcedure.input(z.object({id:z.number()})).query(({input,ctx})=>db.getSimulationById(input.id,ctx.user.id)),
    delete: protectedProcedure.input(z.object({id:z.number()})).mutation(({input,ctx})=>db.deleteSimulation(input.id,ctx.user.id)),
    duplicate: protectedProcedure.input(z.object({id:z.number()})).mutation(({input,ctx})=>db.duplicateSimulation(input.id,ctx.user.id)),
  }),
  dashboard: protectedProcedure.query(({ctx})=>db.getDashboardData(ctx.user.id)),

  auth: router({
    // Retorna o usuário autenticado (ou null)
    me: publicProcedure.query(opts => opts.ctx.user),

    // Login com email + senha
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(1, "Senha obrigatória"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.active) {
          throw new Error("Credenciais inválidas");
        }
        const valid = await db.verifyPassword(user, input.password);
        if (!valid) {
          throw new Error("Credenciais inválidas");
        }
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

    // Registro de novo usuário
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
        if (existing) {
          throw new Error("Email já cadastrado");
        }
        const totalUsers = await db.countUsers();
        const role: "admin" | "user" = totalUsers === 0 ? "admin" : "user";
        const user = await db.createUser({
          email: input.email,
          password: input.password,
          name: input.name,
          role,
        });
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
        return { success: true as const, user };
      }),

    // Logout — limpa o cookie
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
