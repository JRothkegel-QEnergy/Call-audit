import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "sonner";
import { PreferencesProvider } from "@/lib/preferences";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Call Audit · Qubico",
  description: "Auditoría de llamadas con IA: la IA propone hallazgos y las personas revisan y deciden.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={archivo.variable}>
      <body>
        <SessionProvider>
          <PreferencesProvider>{children}</PreferencesProvider>
        </SessionProvider>
        <Toaster
          position="bottom-center"
          offset={84}
          toastOptions={{
            style: { background: "var(--ink-900)", color: "#fff", border: "0", fontFamily: "var(--font-sans)" },
          }}
        />
      </body>
    </html>
  );
}
