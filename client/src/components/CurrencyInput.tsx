/**
 * CurrencyInput.tsx — Input com máscara automática de moeda (R$)
 *
 * Comportamento:
 *  - O usuário digita apenas dígitos; a máscara formata automaticamente
 *  - Exibe: "R$ 1.250,00" enquanto o usuário digita
 *  - O valor numérico real é retornado via onValueChange (number)
 *  - Compatível com todos os campos de valor do sistema
 *
 * Uso:
 *   <CurrencyInput value={1250.50} onValueChange={(n) => setPrice(n)} />
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  /** Valor numérico atual (em reais) */
  value?: number | string;
  /** Callback com o valor numérico limpo (ex: 1250.50) */
  onValueChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  /** Se true, não exibe o prefixo "R$" */
  noPrefix?: boolean;
  /** Tamanho do input */
  size?: "sm" | "md" | "lg";
  /** Mínimo de casas decimais (padrão: 2) */
  decimalPlaces?: number;
}

/**
 * Formata um número para exibição em moeda brasileira sem o símbolo R$
 * Ex: 1250.5 → "1.250,50"
 */
function formatBRL(value: number, decimalPlaces = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

/**
 * Converte string digitada para número.
 * Remove tudo exceto dígitos e vírgula/ponto.
 * Suporta formato BR "1.250,50" e formato US "1250.50".
 */
function parseToNumber(raw: string): number {
  // Remove símbolo de moeda, espaços e letras
  let cleaned = raw.replace(/[R$\s]/g, "");
  // Se tem vírgula como separador decimal (formato BR)
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Máscara de digitação: converte dígitos brutos em formato BRL
 * O usuário digita "125050" → exibe "1.250,50"
 */
function maskFromDigits(digits: string, decimalPlaces = 2): string {
  // Manter apenas dígitos
  const onlyDigits = digits.replace(/\D/g, "");
  if (!onlyDigits || onlyDigits === "0".repeat(onlyDigits.length)) return "";

  // Converter centavos: os últimos `decimalPlaces` dígitos são decimais
  const padded = onlyDigits.padStart(decimalPlaces + 1, "0");
  const intPart = padded.slice(0, padded.length - decimalPlaces);
  const decPart = padded.slice(padded.length - decimalPlaces);

  const intFormatted = new Intl.NumberFormat("pt-BR").format(parseInt(intPart, 10));
  return `${intFormatted},${decPart}`;
}

export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "0,00",
  disabled = false,
  className,
  id,
  name,
  noPrefix = false,
  size = "md",
  decimalPlaces = 2,
}: CurrencyInputProps) {
  // Estado interno: string formatada para exibição
  const [displayValue, setDisplayValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitialized = useRef(false);

  // Sincronizar valor externo → display (apenas na inicialização ou mudança externa)
  useEffect(() => {
    const numericValue = typeof value === "string" ? parseToNumber(value) : (value ?? 0);
    if (!isInitialized.current) {
      if (numericValue > 0) {
        setDisplayValue(formatBRL(numericValue, decimalPlaces));
      }
      isInitialized.current = true;
      return;
    }
    // Atualização externa (ex: reset de formulário)
    if (numericValue === 0 && displayValue !== "") {
      // não limpar se o usuário está digitando
    } else if (numericValue > 0) {
      const current = parseToNumber(displayValue);
      // Só atualiza se o valor externo mudou significativamente
      if (Math.abs(current - numericValue) > 0.001) {
        setDisplayValue(formatBRL(numericValue, decimalPlaces));
      }
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Se o usuário apagou tudo
      if (!raw || raw === "") {
        setDisplayValue("");
        onValueChange(0);
        return;
      }

      // Extrair apenas dígitos da entrada
      const digits = raw.replace(/\D/g, "");

      if (!digits || digits === "0".repeat(digits.length)) {
        setDisplayValue("");
        onValueChange(0);
        return;
      }

      // Gerar display formatado
      const formatted = maskFromDigits(digits, decimalPlaces);
      setDisplayValue(formatted);

      // Calcular valor numérico real
      const numericValue = parseToNumber(formatted);
      onValueChange(numericValue);
    },
    [onValueChange, decimalPlaces]
  );

  const handleBlur = useCallback(() => {
    // Na saída do campo, garantir formatação completa
    const numericValue = parseToNumber(displayValue);
    if (numericValue > 0) {
      setDisplayValue(formatBRL(numericValue, decimalPlaces));
    }
  }, [displayValue, decimalPlaces]);

  const handleFocus = useCallback(() => {
    // Ao focar, selecionar tudo para facilitar substituição
    inputRef.current?.select();
  }, []);

  const sizeClass = {
    sm: "h-8 text-sm",
    md: "h-9 text-sm",
    lg: "h-10 text-base",
  }[size];

  return (
    <div className="relative flex items-center">
      {!noPrefix && (
        <span className="absolute left-3 text-xs text-muted-foreground pointer-events-none font-mono select-none z-10">
          R$
        </span>
      )}
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          sizeClass,
          !noPrefix && "pl-9",
          "font-mono",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        autoComplete="off"
      />
    </div>
  );
}

/**
 * Versão simplificada para uso inline em tabelas (sem prefixo R$, menor)
 */
export function CurrencyInputCompact({
  value,
  onValueChange,
  disabled,
  className,
}: Pick<CurrencyInputProps, "value" | "onValueChange" | "disabled" | "className">) {
  return (
    <CurrencyInput
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className={cn("h-8 text-sm", className)}
      noPrefix
      placeholder="0,00"
    />
  );
}

export default CurrencyInput;
