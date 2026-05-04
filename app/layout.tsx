import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocAgent — análisis de documentos con IA",
  description: "Sube un documento y conversa con su contenido. Powered by Mastra + Llama 3.3 70B.",
};

// Script bloqueante para aplicar el theme antes de hidratación.
// Esto evita el flash blanco-a-oscuro y previene errores de hidratación.
const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('docagent-theme');
    var theme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geist.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
