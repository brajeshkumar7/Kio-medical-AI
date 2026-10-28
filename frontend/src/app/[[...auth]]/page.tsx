import AuthShell from "@/features/auth/components/auth-shell";
import ClerkAuthForm from "@/features/auth/components/clerk-auth-form";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

export default async function RootPage({
  params,
}: {
  params: Promise<{ auth?: string[] }>;
}) {
  const { auth: segments = [] } = await params;
  // Missing assets can reach this catch-all even though the proxy skips them.
  // Render not-found before auth() requires Clerk's middleware context.
  const filename = segments.at(-1) ?? "";
  if (
    /\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)$/i.test(filename)
  ) {
    notFound();
  }

  const { userId } = await auth();
  if (userId) redirect("/console");

  return (
    <AuthShell allowGuest>
      <ClerkAuthForm mode="sign-in" onHomePage />
    </AuthShell>
  );
}
