import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ToastProvider } from "@/components/ui/Toaster";
import { CurrencyProvider } from "@/lib/currencyContext";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import PWAInstallBanner from "@/components/pwa/PWAInstallBanner";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "My Finance Partner",
  description: "Personal finance tracker for expats",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FinPartner",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 antialiased`}>
        <ToastProvider>
          <CurrencyProvider>
            <Navigation />
            <main className="max-w-2xl mx-auto px-4 pt-5 pb-28 sm:pb-10 min-h-screen">
              {children}
            </main>
            <PWAInstallBanner />
          </CurrencyProvider>
        </ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
