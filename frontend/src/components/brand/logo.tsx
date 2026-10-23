import Image from "next/image";
import logo from "@/assets/brand/qubico-logo.png";
import logoDark from "@/assets/brand/qubico-logo-dark.png";
import symbol from "@/assets/brand/qubico-symbol.png";
import symbolDark from "@/assets/brand/qubico-symbol-dark.png";

/**
 * Logo oficial de Qubico (PNG con fondo transparente, recortado del original de la marca).
 * `full`: símbolo + logotipo. `symbol`: solo el cubo, para la sidebar colapsada.
 * `onDark`: versión blanca para fondos oscuros (panel del login).
 */
export function BrandLogo({
  variant = "full",
  onDark = false,
  height = 28,
  className,
}: {
  variant?: "full" | "symbol";
  onDark?: boolean;
  height?: number;
  className?: string;
}) {
  const src = variant === "symbol" ? (onDark ? symbolDark : symbol) : onDark ? logoDark : logo;
  const width = Math.round((src.width / src.height) * height);
  return <Image src={src} alt="Qubico" width={width} height={height} priority className={className} style={{ height, width }} />;
}
