import Link from "next/link";

export function AuditorsTabs({ active }: { active: "performance" | "accounts" }) {
  return (
    <div className="tabs" role="tablist">
      <Link href="/auditors" role="tab" className="tab" aria-selected={active === "performance"}>
        Desempeño
      </Link>
      <Link href="/auditors/accounts" role="tab" className="tab" aria-selected={active === "accounts"}>
        Cuentas
      </Link>
    </div>
  );
}
