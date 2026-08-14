import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nexor Vault", template: "%s · Nexor" },
  description: "Secure every connection. Vault de contraseñas zero-knowledge por Nexor.",
  applicationName: "Nexor Vault",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
  themeColor: "#0b0d10",
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
