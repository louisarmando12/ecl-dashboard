import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import LiveDrawing from "@/components/LiveDrawing";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "ECL | Esports Corporate League",
  description: "Official Dashboard for Esports Corporate League",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${outfit.variable} font-sans antialiased min-h-screen bg-brand-dark text-brand-white bg-gradient-esports`}
      >
        {children}
        <LiveDrawing />
      </body>
    </html>
  );
}
