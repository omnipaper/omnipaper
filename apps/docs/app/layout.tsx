import "./global.css";
import { OpenPanelComponent } from "@openpanel/nextjs";
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
        <OpenPanelComponent
          clientId="3855a53b-37eb-4f33-937e-bbbf6334ab01"
          apiUrl="https://openpanel-api.mateusztylec.com"
          scriptUrl="/op1.js"
          trackScreenViews
          trackOutgoingLinks
          trackAttributes
        />
        <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
      </body>
    </html>
  );
}
