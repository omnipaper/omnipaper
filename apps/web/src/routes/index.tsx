import { Button } from "@omnipaper/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { configQueryOptions } from "@/features/auth/queries/config";
import { config } from "@/lib/config";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // A demo instance has no "marketing" landing — drop straight into the (auto-logged-in) app.
    const { demoMode } = await queryClient.ensureQueryData(configQueryOptions);
    if (demoMode) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{config.appName}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sign-up">Sign up</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
