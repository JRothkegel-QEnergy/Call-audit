/**
 * Lector de Markdown mínimo para los informes (D-16): títulos, párrafos, listas, citas, negrita, cursiva y enlaces
 * internos. Construye elementos de React: nunca inserta HTML crudo, así que un informe no puede inyectar código.
 */
import Link from "next/link";
import { Fragment } from "react";

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      // Solo enlaces dentro de la app (p. ej. «Ver en Criterios»): cualquier otro queda como texto.
      out.push(href.startsWith("/") ? <Link key={k} href={href}>{label}</Link> : <Fragment key={k}>{label}</Fragment>);
    }
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="grid max-w-[72ch] gap-3 leading-6">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        const key = `b${b}`;
        const heading = lines[0].match(/^(#{1,4})\s+(.*)$/);
        if (heading && lines.length === 1) {
          const level = heading[1].length;
          const cls = level <= 2 ? "m-0 text-lg font-semibold" : "m-0 text-base font-semibold";
          return level <= 2 ? (
            <h3 key={key} className={cls}>{inline(heading[2], key)}</h3>
          ) : (
            <h4 key={key} className={cls}>{inline(heading[2], key)}</h4>
          );
        }
        if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
          return (
            <ul key={key} className="m-0 grid gap-1 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+\.\s+/.test(l)))
          return (
            <ol key={key} className="m-0 grid gap-1 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*\d+\.\s+/, ""), `${key}-${i}`)}</li>
              ))}
            </ol>
          );
        if (lines.every((l) => l.startsWith(">")))
          return (
            <blockquote key={key} className="quote m-0">
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), key)}
            </blockquote>
          );
        return <p key={key} className="m-0">{inline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
