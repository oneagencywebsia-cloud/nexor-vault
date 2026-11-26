import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Gestiona las contraseñas y los códigos 2FA de tu negocio desde un único lugar. Cifrado en tu dispositivo (zero-knowledge).";

export const metadata: Metadata = {
  // Las apps de mensajería necesitan la URL completa de la imagen de presentación
  // (app/opengraph-image.jpg); sin esta base saldría apuntando a localhost.
  metadataBase: new URL(SITE_URL),
  title: { default: "Nexor Vault", template: "%s · Nexor" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image" },
  applicationName: "Nexor Vault",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nexor",
  },
  formatDetection: { telephone: false },
  // Next solo emite el meta "mobile-web-app-capable" (estándar nuevo) — iOS
  // Safari (incl. versiones previas a 16.4) todavía necesita el nombre
  // legado "apple-mobile-web-app-capable" para el modo standalone real al
  // añadir a pantalla de inicio.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-void">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
