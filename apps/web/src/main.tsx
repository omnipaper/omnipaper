import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClientLayout } from "./components/client-layout";
import { QueryProvider } from "./components/providers/query-provider";
import { parseSearch, stringifySearch } from "./lib/search-params";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const router = createRouter({ routeTree, parseSearch, stringifySearch });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryProvider>
      <ClientLayout>
        <RouterProvider router={router} />
      </ClientLayout>
    </QueryProvider>
  </StrictMode>,
);
