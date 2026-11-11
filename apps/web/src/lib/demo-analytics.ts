import { DEMO_MODE } from "@/lib/demo-mode";

/*
  OpenPanel web analytics for the hosted demo only. Like DEMO_MODE, the client id is a BUILD-TIME
  constant read straight from import.meta.env: in public builds both are unset, the bundler folds the
  check below to false and drops the dynamic import, so self-hosted images ship no analytics code.
*/
const OPENPANEL_CLIENT_ID: string | undefined = import.meta.env.VITE_OPENPANEL_CLIENT_ID;
const OPENPANEL_API_URL = "https://openpanel-api.mateusztylec.com";

export async function startDemoAnalytics(): Promise<void> {
  if (!DEMO_MODE || !OPENPANEL_CLIENT_ID) {
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
