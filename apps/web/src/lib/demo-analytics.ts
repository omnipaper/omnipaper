import { DEMO_MODE } from "@/lib/demo-mode";

// Demo-only analytics. Build-time constants: unset in public builds, so the bundler drops the
// import below and self-hosted images ship no analytics code.
const OPENPANEL_CLIENT_ID: string | undefined = import.meta.env.VITE_OPENPANEL_CLIENT_ID;
const OPENPANEL_API_URL: string | undefined = import.meta.env.VITE_OPENPANEL_API_URL;

export async function startDemoAnalytics(): Promise<void> {
  if (!DEMO_MODE || !OPENPANEL_CLIENT_ID || !OPENPANEL_API_URL) {
    return;
  }

  const { OpenPanel } = await import("@openpanel/web");
  new OpenPanel({
    clientId: OPENPANEL_CLIENT_ID,
    apiUrl: OPENPANEL_API_URL,
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true,
  });
}
