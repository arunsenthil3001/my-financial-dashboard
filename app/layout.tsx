import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ToastProvider } from "@/components/ui/Toaster";
import { CurrencyProvider } from "@/lib/currencyContext";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "My Financial Dashboard",
  description: "Personal savings and expense tracker for salaried individuals",
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
          </CurrencyProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
