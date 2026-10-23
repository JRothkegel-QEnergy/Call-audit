import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

/**
 * Resúmenes en lenguaje claro (06-ux-writing.md §4). No reemplazan los textos legales
 * completos, que debe validar un abogado (L-27). Los `TBD` los define el cliente.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <BrandLogo height={30} />
      </div>
      <h1 className="m-0 mb-6 text-[22px] font-semibold">Privacidad, términos y cookies</h1>

      <section className="card mb-4" id="privacidad">
        <h2 className="m-0 mb-2 text-lg font-semibold">Cómo tratamos tus datos en Call Audit</h2>
        <ul className="m-0 grid gap-1.5 pl-5">
          <li>
            <b>Qué datos:</b> tu nombre, correo, rol y tu actividad en la app (qué casos revisas, tus decisiones, tiempos de revisión y
            un registro de accesos que incluye las búsquedas por ejecutivo).
          </li>
          <li>
            <b>Para qué:</b> darte acceso, dejar trazabilidad de cada decisión y permitir que tu supervisor apruebe y controle la calidad de
            las revisiones.
          </li>
          <li>
            <b>Quién los ve:</b> tu supervisor y el equipo de Qubico que opera la plataforma.
          </li>
          <li>
            <b>Cuánto tiempo:</b> TBD (lo define la empresa cliente).
          </li>
          <li>
            <b>Tus derechos:</b> puedes pedir acceso, rectificación o eliminación de tus datos a TBD.
          </li>
        </ul>
      </section>

      <section className="card mb-4" id="terminos">
        <h2 className="m-0 mb-2 text-lg font-semibold">Al usar Call Audit te comprometes a:</h2>
        <ul className="m-0 grid gap-1.5 pl-5">
          <li>usar las llamadas y sus datos solo para auditar la calidad;</li>
          <li>no copiar, descargar ni compartir audios, transcripciones o datos de clientes fuera de los canales autorizados;</li>
          <li>mantener tu cuenta personal e intransferible.</li>
        </ul>
        <p className="mb-0">Los hallazgos de la IA son propuestas: las decisiones las toman las personas.</p>
      </section>

      <section className="card mb-6" id="cookies">
        <h2 className="m-0 mb-2 text-lg font-semibold">Cookies</h2>
        <p className="m-0">Call Audit usa solo cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de analítica.</p>
      </section>

      <p className="help">Resumen en lenguaje claro. El texto legal completo está pendiente de validación.</p>
      <Link href="/login">Volver</Link>
    </div>
  );
}
