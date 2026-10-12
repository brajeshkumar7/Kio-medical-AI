import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth-shell";
import ClerkAuthForm from "@/components/clerk-auth-form";

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect("/console");

  return (
    <AuthShell>
      <ClerkAuthForm mode="sign-in" onHomePage />
    </AuthShell>
  );
}
