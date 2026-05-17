/**
 * Marketplace.tsx — Vitrine Pública "Silent Wealth" — Shoop Permupay
 * Logo PNG real. Estética premium: off-white, serifada, botões pílula.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Heart, ArrowRight, ShoppingBag } from "lucide-react";

interface CatalogProduct {
  id: number; name: string; category: string; categoryLabel: string | null;
  shortDescription: string | null; description: string | null;
  imageUrl: string | null; promoTag: string | null;
  suggestedPrice: number; suggestedPricePix: number;
  suggestedPriceCard: number; suggestedPriceBoleto: number;
  stockQuantity: number; minimumStock: number;
  paymentPlatform: string | null; pixKey: string | null;
  pixLink: string | null; cardPaymentUrl: string | null;
  boletoUrl: string | null; cardInstallments?: number | null; boletoMonths?: number | null;
}

// ── Logos ────────────────────────────────────────────────────────────────────
const LOGO_LIGHT = "data:image/png;base64,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";
const LOGO_DARK  = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCACHAJoDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAEHBAUGCAID/8QAPxAAAQMEAQIEAgcGAwgDAAAAAQIDBAAFBhEhEjEHE0FRCHEUIjJCYYGRFRZSYqGxIyXBFxgkM2NyktFzsvD/xAAZAQEBAQEBAQAAAAAAAAAAAAABAAIDBAX/xAAeEQEBAQEAAwEBAQEAAAAAAAABAAIREiExAxNBIv/aAAwDAQACEQMRAD8AvIGm6igr4t7qabpSqpupFRTdVQmm+KVBqmEnYPGvnX4iXEJIEln25cHFfopJII9x2rzl8TWLW3H37RerShURU6SpiS22shCj0lQVr0PB/Wt4z5Nl1y9EmXEA5lMb/wDkFfo2404NtuIWP5VA/wBqrJjwZwdcVpa0XMqUgE/8Yr1FcP4g4HffD96PlHh7crw+lDoS/b1OKeGj/KPtJ99jY3vdJkXnY8r0QDU7rT4ZdHb7itvvD8VyI9JaCnWHElKm19lAg/iK3GqwnPVqU3SoNFU7puopVU3SlKSaKVJoBQVKUNKolKUqqg9qxrnOiWy2ybjOeDMaK0p15Z+6lI2TWTXGeN0STN8Kcijwm1uPGEs9CBsrA5IH5A1rPtp+VSMZVm/i5mK7JZbi7j9mDZfUWthxLHAClqHPUrYISNdxX5+OmIxsOw3HIDV1uVzLt6Lrj014uL35Khob7D8K5jwkzFOE385MI7k60TozcWelkbcjlIQArXsegKH/AHEeld941XW2+JGMWOTh0lFzVFnF59hJ08hPlqHKDzvZFelHOwPlx70ub8PsUlZ9mWTRpWVX+3twHUFsRZiwD1E8a6tDt6V3X+wxtPKPEHLArfG5i9f/AGrG+HaG/GznNQ+w4ztbOvMQU75V2339KuvuNjVY/T9E1wt4Dl5zy+D4n+F3l3CHlcm6WcrCfMfPmJbPs4lWyPmDVleEPigxl63LPdWEQb6wjrU2g7beT/Eg/wCldVm1vZu2G3i3PoStL8NwaUOxCSQf1FeQcMuD9sv+J3RCyiSxPMdak/eQCOD79zTnm8+4VG9tk81FQOT1D15qTXn5y6kpTVPWimcU49qUqolN0pxVEFDUioNVSlKVVQaggFJSQCDwQa+j2qrPEPxaexHMH7B+7bk3y4yJKXQ+E9SCkknR9ilX6VrOXTwheFr818Eoki4u3jEJ/wCx5bhKlxincdZ17egO+2iKqzJcGyq0uefd8SWQFEfS7S90rIHrpPp+HFelPDvJk5hh0LIExTE+kl1KmSrq6ChxSCN+v2d/nVafFXJkxrVjDsaS8yo3XW21lJP+Go+nyrt+e9eXi2NB9KpbLml+sT4bsOYymHEjiJdkHQ/l6lf6mrMxXx0nxJjULOrSiO26QlufE+s2r3JH/quMtjeZZdkl9hQrHbMkjRXgHm5wShSEqPAS4PrehrGzfC5WHItjsiK5Gtt3WWHoLjod+jOa3tC/lyD39K6ucrxsGk91/wDibl1ss3hzLu7Mpp8z2C1ADat+cpY0On3rzl4aY8/es1xywsNl0wXvplxWOQ1zsgn34H61keF2A3TxBmPRDfDGt9lX5f1gVFHUT/y09hvW/wA69M4BhVjwq1qh2lpSnXOX5Dp246fxPt+Fc1z+YhaO6e3SnXUddvSo1QcVNee6yoHeppRM1UVJNRxVFFTSlUzdKUqinVRTfFKqoqtfHPBZmTRYV8sSUKvVrJ00rgSWT9po/wCnzI9asulayuXpSD9vM3gl4lw8NuUvEMhblQbf55VHVIQfMirUeUOD+En7w+frXR/E5Nt11x3FpNunR5TRu32mnAsAeUv2q2slxDGclbKL7ZYk0n762wF/+Q5qhPiAwPF8IYsU2wsvR3pc4ocbXIUtIQEKOwknQ51zXfGs61343NymboPh6fjRMwzh2RIaZaDjJK3FhI7r9TWi+IPNYGVXe1Yri4Vc34snzVlgdQcc0QlCfcDeye1fHgtaLJluU5hZrykvMOrZkJbQ8UlzoWexHccjdX1i+I4xjSf8kssOGr+NDY6//I81a0Z31jIubnPAnB38Lw8t3IJF2nufSJgSdhJ9E79dD+9WAeDU73zSuGteT1up6JQUNRWapqDTdKpJSlKSmUpSiJulBrdYN5u1qsscSLxc4dvZUdBcl5LYJ9hs808X5S8s6la2yX6xXxC1Wa8wLiEfb+jPpc6fnrtS4X6x2+V9EuF5t8OR0BflPyEoWUnsdE71x3q8WulsamsS23GBc4ol22bHmx9lPmsOBaCQdEbHHFYc3JsdhTXYMu/WyPJY0HWnZKErQSNjYJ2OCDVxnpbZR4/LXFVpf/BjE7/c13G7S75LkL39Zy4LPSNk6HsOasOHLjTIzcqHIakx3Rtt1pYUhQ3rgjv2qZkqLCjKlTpLEWOj7TrywhI/M8UmtHyHlWUHwJwuDMRLgyL5GktHaHG7gtKgfnVmwIwiQmYwdddDSAnrdWVLVr1JPc1qLfm2HT5Iiwcqsj76j9VCJrZUflzzXQLGjo+vrTryfsHD5fIqa+SedCtPe8rxqyP+ReMhtcB48+W/JShf6E7rILPeW63StZZL9Zb22XbPd4NxQn7RjPpc6fno8VsgRolXAA33q5PRppWnVleKpQVqyWzJQDoqM1sa/rWZarvaLslSrVdIU8J7/Rn0ua/Q0+LHSzKU1U8UTQaUNKCprkH0ql8eu9s/3lcqh5O42JpaZj2YyddCEBPUUI3wlSgUq/Hmrn9QdVw3ij4Z454gx0PTCuJcWkdDE5kAq6fRCweFpB9O49CK6/mh9uex/wAunjWG3xclevkWM0xJfiiM8UI6fMAV1JJ16jkVVPxhsNr8L4r5QnzGLo0Uq1o6LTwI37cj9KjwiyDLsaz53wtzR8T1oil+2zdklTY9Oo8qSRvW+UlJBJr9/i/2PCdBHTxcmtb7cNO1vibBY7/zW1b0ttwIzbaEtoDKAAngD6oql/ilYYVc8AWplClO3wNLUUjakEo2k+4qw4OCwW4zB/eDLCfKQdftt/X2R6b1VY/ERZI9ouOAusTrrJU7fkIUJs5b4SAUHaeo8HjuKvzDzjS8K8r1LiWa0y7lJ01DhMreWANBKUjZAH5VWHhBFfz5cjxEyxIl+a+tq0QnOWYbSTokIPHWTwTz2Pvx2fjHBk3PwuyWDEQVvu294NpH3iBvX9K5r4ZJ0aZ4QW5qO6lS48iQ26AQSCXCsfqlQNZDmF/2vry7u82KyXq3uW+6WqJJiupKSlTSeAfY9wflVVeGN5nYh4pT/Cq5zXJduCPNsrjyupaEEdQQSfTXUPmPxq4zx3J/9VQuVtG7fFnY2Iewq3Rm3pKk+gAUrR/oOfen83y6NrRznLtPHfK7lZLdbLBj7qWLxfpIjNP9/JR2UoeyvQV1GG4nasVtDdvhR0qdSnciS4Op2Q595a1Hkkmqr+IFarb4nYFepOxCRKCCVfZCgsE/0q91EKO09jyPlRr1g5R7WrHxoxFuVYX8qsH+WZJZkGTGlxgEKcSnlSF64UNb71u/BjMDm+BQrzI6EzOWpSUDSfNTwSB7HvXQ5M4xGxe7yZBAZahPKXv2CDVT/CPCkRvDyXOc60tTrgtxgEfdACdj8Dqn7h7T61QxDhn4rZSVxGFoctJcKVNgpKulvnRqPiXgQ7AzjeZWKO1Cvse6ojtORkhBeSoKJQoDvvWufRRr5WXj8VTyWHi04qynoWUBQSdN86J5+Vd7IwWNd8kt9/yi6Sby9bSVW+KppDUaOs919CeVK4H2iew9q0ocWz7S61ClGO04oaUpAUR7Gpr6J2e+6+T3rh/vbr8lKU9KzMGuod+/pVf2RedY0/Pgy8c/b1vXMefgybdNbDiG3FlXQ4h0o0RvQ0T/AEqwKnezzo/lWjXLKdq7x7Fb3dPE9fiDksZq2mNC+g2y3Nuh1aGydqceUPq9RJVoJ7A+uqwviKxTKM1xOPj+NwWXD9KTIdeflIaQEhDiekAnZO1g9tcd+atEn03/AErlLln+OW6dcIkpVzH7Od8qbIbtj648dXSlR63UpKQAFAkk6HrWzS6ELPAt5Y1zXLXGNwgmFJQ2lDjJeS4NhIBIUkkEH8dH8KrnxwxTK8vueOGxWlhcezXATXHX5rbfmkdP1UJ5PoeTrmu4yXKbVYG4CpYmyDcFqRFRCiuSVukI6zpKATrp5orKbazi0vJJbVxhwIiFOPCXCcZdSlPc+WodRHtxzUeWdeXJ9Pq3LDzsmOh2RDXEcWNqYcWlZTyeCUkg/l71WUXBL9hOWzb7gf0SXarovruNjlO+VpX8bDmtA7J+qr3I3212OP5fZ7zcBbmU3CJMW2XW2Z0F2Mp1A1tSPMSOoDY3rtusy0X61XW73W0QZYenWpxLcxrRCmypIUk89wQRyKO6O+qeWlcvuXSI7jUDBJsWVrSFXGdHQwk+hUW1rUR+ATzWN4c4GMcl3C+3SYi55Jdl9c+YEdKB/wBNtPdKBoDnk6FdJbr9abim5Lhyg+m2OqYlKAOkLSkKUAfXQPp61+KcktKsfg31L7hgzvL8hYaO1dZ0njuKXyBAr1Y/iBiNrzXGX7JdQtKHPrNPN662VjstO/WtDiR8QMWtbVkvVk/eiNF/w4lwtsltDymx2Drbqk/WA42Ca32SZbaLBdmrTMaucia6yXktQ7e9JPQDoqPlpOhv3rYWW+W682lF0t8kuxTsFSklBQU/aCkqAKSPUEVDoz7KeLcll1py/OoibHJifuxjz2jPU5IQ5OkJB35aAglLYPqokn8K7KzWyDZrRGtNrjpjw4jQaZbSewA/v+NYOM5NZ8ltLlzs8kyozbi21aQoKCkdxo8/L3pEyeySLRDujMsrjznQzHAbPmLWSR0dOt7Gjsemql0nK4FX/wC7GaJ8cjm5x9o2oxDE8oXBrz9EJHVrevu9t+tWz6dtH2qST22ajZrO9eVrJybpSlZJafSopulFSpFKg96ovrnWwRVexsTvk+fm0aRdpFstV5uCtNtMIUt5lcdtClJWfs70pPI9KsD13TdbzvkOe3A+I1kmqlYg5aoF0fi2mQ75iLa8hDzbZjltGisgHnQqcihXS8+EV/s8a2XhE5+K80w1cnW1vuKVyD1IPTrfA+Vd6Dxqm/l+lP8AR5Bm4e02S+s5vb5t6mO3WHHgLTEdDSGkxXz0hYWkcq6k8A9ho77itaMNvv7z3+92p1q13CVdABIcT1B+EthtCxxztKklSf5kj0NWUST3/tTdP9XvacFxuB4t+wouT2xqN9Egy5qjEJOytssISVn1JKgoknknZrQ2u3ZK7jOP4Y7j8iJ+zJDIk3BbrZYUy0vqCkaV1EqGuNcGrQ2abP8A+FD+j9jwuMySzXyb4nxbtbpZt8dFscZXJ8lLv1isEI6SfbndY96xmfb8Lex7HnXHZlzkn6VOkJB11nbjikjQ1rjQ967uo43vQq/os+FwWH2HJrBmrz0xVul2+4xUpcXAiqYSw60OlJUlS1Ekp0Nj2rLtWKJieJtwvSY60wVR0uRUkgtokuHTy0D0JATuu0FBU/ovuTE701SlYmilDSoqippSgmbpSlUSlKVVKUpVUpSlUkNKUqplKUqibpSlMzZps0pRUpSlJF//2Q==";

// ── Utils ─────────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CAT: Record<string, string> = {
  CELULAR: "Celulares", ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias", OUTRO: "Outros",
};
const pixPrice  = (p: CatalogProduct) => (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix : (p.suggestedPrice ?? 0) > 0 ? p.suggestedPrice : null;
const cardPrice = (p: CatalogProduct) => (p.suggestedPriceCard ?? 0) > 0 ? p.suggestedPriceCard : null;
const hasStock  = (p: CatalogProduct) => (p.stockQuantity ?? 0) > 0;
const isLow     = (p: CatalogProduct) => (p.minimumStock ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 0);

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] bg-neutral-100 mb-5" />
      <div className="space-y-2 px-1">
        <div className="h-2 bg-neutral-100 rounded w-14" />
        <div className="h-3.5 bg-neutral-100 rounded w-4/5" />
        <div className="h-3 bg-neutral-100 rounded w-1/3 mt-3" />
      </div>
    </div>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({ product: p }: { product: CatalogProduct }) {
  const stock = hasStock(p);
  const low   = isLow(p);
  const pix   = pixPrice(p);
  const card  = cardPrice(p);
  const inst  = Math.max(1, Math.round(p.cardInstallments ?? 3));

  return (
    <article className={`group ${!stock ? "opacity-40" : ""}`}>
      {/* Imagem flutuante */}
      <div className="relative overflow-hidden bg-[#F4F2EE] mb-5"
        style={{ aspectRatio: "4/5" }}>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name}
            className="w-full h-full object-contain p-7 group-hover:scale-[1.05] transition-transform duration-700 ease-out" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-neutral-200" />
            <span className="text-[9px] text-neutral-300 mt-2 tracking-widest uppercase">Sem imagem</span>
          </div>
        )}

        {p.promoTag && stock && (
          <span className="absolute top-3 left-3 text-[9px] font-bold tracking-[0.22em] uppercase text-neutral-500 bg-white/95 px-2.5 py-1">
            {p.promoTag}
          </span>
        )}
        {low && stock && (
          <span className="absolute top-3 right-3 text-[9px] font-medium text-amber-700 bg-amber-50/95 px-2.5 py-1">
            Últimas unidades
          </span>
        )}
        {!stock && (
          <div className="absolute inset-0 flex items-end p-4">
            <span className="text-[9px] tracking-widest uppercase text-neutral-400 border-t border-neutral-200 pt-2 w-full">
              Indisponível
            </span>
          </div>
        )}

        {/* Hover overlay */}
        {stock && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
            <div className="bg-neutral-950/96 backdrop-blur-sm py-3.5 text-white text-[9px] font-bold tracking-[0.22em] uppercase text-center flex items-center justify-center gap-2">
              Ver produto <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-0.5 space-y-2">
        <p className="text-[8px] font-bold tracking-[0.32em] uppercase text-neutral-400">
          {p.categoryLabel || CAT[p.category] || p.category}
        </p>
        <h3
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "0.95rem", fontWeight: 600, lineHeight: 1.3, color: "#1c1917" }}
          className="line-clamp-2 group-hover:opacity-60 transition-opacity duration-300">
          {p.name}
        </h3>
        {p.shortDescription && (
          <p className="text-[11px] text-neutral-400 line-clamp-1">{p.shortDescription}</p>
        )}

        {/* Preço + Botões */}
        {stock && pix ? (
          <div className="pt-2 space-y-3">
            <div className="flex items-baseline gap-2.5">
              <span className="text-lg font-bold text-neutral-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {fmt(pix)}
              </span>
              <span className="text-[8px] font-bold tracking-[0.2em] uppercase text-emerald-600">via pix</span>
            </div>
            {card && inst > 1 && (
              <p className="text-[10px] text-neutral-400">ou {inst}× {fmt(card / inst)} no cartão</p>
            )}

            {/* Botões de ação */}
            <div className="flex gap-2 pt-1">
              {p.pixLink ? (
                <a href={p.pixLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center py-2 bg-neutral-900 text-white text-[9px] font-bold tracking-[0.18em] uppercase hover:bg-neutral-700 transition-colors rounded-full">
                  Pix
                </a>
              ) : p.pixKey ? (
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(p.pixKey!); }}
                  className="flex-1 text-center py-2 bg-neutral-900 text-white text-[9px] font-bold tracking-[0.18em] uppercase hover:bg-neutral-700 transition-colors rounded-full">
                  Pix
                </button>
              ) : null}
              {p.cardPaymentUrl && (
                <a href={p.cardPaymentUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center py-2 border border-neutral-300 text-neutral-700 text-[9px] font-bold tracking-[0.18em] uppercase hover:border-neutral-600 hover:text-neutral-900 transition-colors rounded-full">
                  Cartão
                </a>
              )}
              {!p.pixLink && !p.pixKey && !p.cardPaymentUrl && (
                <Link href={`/vitrine/${p.id}`}>
                  <button className="flex-1 text-center py-2 bg-neutral-900 text-white text-[9px] font-bold tracking-[0.18em] uppercase hover:bg-neutral-700 transition-colors rounded-full">
                    Ver produto
                  </button>
                </Link>
              )}
            </div>
          </div>
        ) : !stock ? (
          <Link href="/desejos">
            <button onClick={(e) => e.stopPropagation()}
              className="mt-2 text-[10px] text-neutral-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors">
              <Heart className="w-3 h-3" /> Avisar quando chegar
            </button>
          </Link>
        ) : (
          <span className="text-xs text-neutral-400 italic">Consulte o preço</span>
        )}
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Marketplace() {
  const [cat, setCat] = useState<string | null>(null);
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const cats     = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const filtered = useMemo(() => cat ? products.filter((p) => p.category === cat) : products, [products, cat]);
  const featured = products.find((p) => p.imageUrl && hasStock(p));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAF9F6" }}>
      {/* Google Fonts inline */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,700&display=swap');
      `}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-neutral-100 bg-[#FAF9F6]/94 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/vitrine">
            <img src={LOGO_LIGHT} alt="Shoop Permupay"
              className="h-11 object-contain cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>

          {/* Nav central */}
          <nav className="hidden md:flex items-center gap-10">
            <button onClick={() => setCat(null)}
              className={`text-[10px] font-semibold tracking-[0.18em] uppercase pb-px border-b transition-colors ${
                cat === null ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-700"
              }`}>
              Catálogo
            </button>
            <Link href="/desejos">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors">
                Lista de Desejos
              </span>
            </Link>
            <a href={`${PANEL}/login`}
              className="text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors">
              Gerenciar
            </a>
          </nav>

          {/* CTA */}
          <a href={`${PANEL}/login`}
            className="text-[10px] font-semibold tracking-[0.18em] uppercase px-5 py-2.5 border border-neutral-800 text-neutral-800 hover:bg-neutral-900 hover:text-white transition-all duration-300">
            Entrar
          </a>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="border-b border-neutral-100/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <p className="text-[9px] font-bold tracking-[0.38em] uppercase text-neutral-400">
              Catálogo Exclusivo · Shoop PermuPay
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(2.6rem, 5vw, 4rem)", fontWeight: 700, color: "#1c1917", lineHeight: 1.05 }}>
              A sua vitrine<br />
              <em style={{ color: "#78350f", fontStyle: "italic" }}>dos desejos.</em>
            </h1>
            <p className="text-neutral-500 text-sm leading-relaxed max-w-xs">
              Produtos selecionados. Preços transparentes. Compra simples, segura e sofisticada.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
                className="px-8 py-3.5 bg-neutral-900 text-white text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-700 transition-colors">
                Explorar catálogo
              </button>
              <Link href="/desejos">
                <button className="px-8 py-3.5 border border-neutral-300 text-neutral-700 text-[10px] font-bold tracking-[0.2em] uppercase hover:border-neutral-700 transition-colors">
                  Lista de desejos
                </button>
              </Link>
            </div>
          </div>

          {/* Visual hero */}
          <div className="hidden lg:flex items-center justify-center relative min-h-[380px]">
            <div className="absolute w-80 h-80 rounded-full border border-neutral-100" />
            <div className="absolute w-56 h-56 rounded-full border border-neutral-100/70" />
            {featured ? (
              <Link href={`/vitrine/${featured.id}`}>
                <div className="relative z-10 cursor-pointer group">
                  <img src={featured.imageUrl!} alt={featured.name}
                    className="w-64 h-64 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute -bottom-4 -right-6 bg-white shadow-xl p-4 min-w-[160px] z-20">
                    <p className="text-[8px] tracking-[0.24em] uppercase text-neutral-400 mb-1 line-clamp-1">
                      {featured.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    <p className="text-lg font-bold text-neutral-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {pixPrice(featured) ? fmt(pixPrice(featured)!) : "—"}
                    </p>
                    {pixPrice(featured) && (
                      <p className="text-[8px] text-emerald-600 font-bold tracking-wider mt-0.5 uppercase">via pix</p>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative z-10 w-64 h-64 flex items-center justify-center">
                <ShoppingBag className="w-16 h-16 text-neutral-200" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ FILTROS ═════════════════════════════════════════════════════════ */}
      {cats.length > 1 && (
        <div className="border-b border-neutral-100 bg-[#FAF9F6]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 h-11 flex items-center gap-10 overflow-x-auto no-scrollbar">
            <button onClick={() => setCat(null)}
              className={`shrink-0 text-[9px] font-bold tracking-[0.28em] uppercase pb-px border-b transition-all ${
                !cat ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-600"
              }`}>
              Todos
            </button>
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`shrink-0 text-[9px] font-bold tracking-[0.28em] uppercase pb-px border-b transition-all ${
                  cat === c ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-600"
                }`}>
                {CAT[c] || c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ PRODUTOS ════════════════════════════════════════════════════════ */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-16">
        <div className="flex items-end justify-between mb-14">
          <div>
            <p className="text-[9px] font-bold tracking-[0.35em] uppercase text-neutral-400 mb-3">Coleção em destaque</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.8rem, 3vw, 2.6rem)", fontWeight: 700, color: "#1c1917", lineHeight: 1.1 }}>
              Vitrine dos <em style={{ color: "#92400e", fontStyle: "italic" }}>Desejos</em>
            </h2>
          </div>
          {!isLoading && filtered.length > 0 && (
            <p className="text-[10px] text-neutral-400 tracking-wide shrink-0">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-10 sm:gap-14">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-36 space-y-5">
            <p className="text-[9px] tracking-[0.38em] uppercase text-neutral-300">Em breve</p>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", fontWeight: 600, color: "#78716c" }}>
              Vitrine em preparação
            </h3>
            <p className="text-sm text-neutral-400">Novos produtos em breve.</p>
            <Link href="/desejos">
              <button className="mt-4 text-[10px] tracking-[0.18em] uppercase border border-neutral-300 text-neutral-500 px-7 py-3 hover:border-neutral-600 transition-colors inline-flex items-center gap-2 rounded-full">
                <Heart className="w-3.5 h-3.5" /> Registrar desejo
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-10 sm:gap-14">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>

      {/* ══ BANNER LISTA DE DESEJOS ═════════════════════════════════════════ */}
      <section className="border-t border-neutral-100 py-24" style={{ backgroundColor: "#F0EDE6" }}>
        <div className="max-w-xl mx-auto px-6 text-center space-y-7">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-neutral-200 bg-white">
            <Heart className="w-5 h-5 text-neutral-400" />
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 600, color: "#1c1917", lineHeight: 1.2 }}>
            Sua Lista de Desejos Personalizada
          </h2>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-xs mx-auto">
            Não encontrou o que procura? Registre sua demanda e entraremos em contato quando disponível.
          </p>
          <Link href="/desejos">
            <button className="mt-2 px-9 py-4 bg-neutral-900 text-white text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-700 transition-colors inline-flex items-center gap-2.5 rounded-full">
              <Heart className="w-3.5 h-3.5" /> Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ══ RODAPÉ ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-neutral-100 py-10 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <img src={LOGO_LIGHT} alt="Shoop Permupay" className="h-8 object-contain" />
          <nav className="flex items-center gap-8">
            <button onClick={() => setCat(null)} className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors">Catálogo</button>
            <Link href="/desejos"><span className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors">Desejos</span></Link>
            <a href={`${PANEL}/login`} className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors">Entrar</a>
          </nav>
          <p className="text-[9px] text-neutral-300 tracking-wide">© {new Date().getFullYear()} Shoop Permupay</p>
        </div>
      </footer>
    </div>
  );
}
