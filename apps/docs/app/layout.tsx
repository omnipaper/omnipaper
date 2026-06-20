import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import SearchDialog from "@/components/search";

export const metadata: Metadata = {
  title: "omnipaper docs",
  description: "Modern, source-available document management with native S3-compatible storage.",
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
      </body>
    </html>
  );
}
