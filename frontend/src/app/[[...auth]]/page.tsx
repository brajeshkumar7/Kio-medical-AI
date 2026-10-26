import AuthShell from "@/features/auth/components/auth-shell";
import ClerkAuthForm from "@/features/auth/components/clerk-auth-form";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect("/console");

  return (
    <AuthShell allowGuest>
      <ClerkAuthForm mode="sign-in" onHomePage />
    </AuthShell>
  );
}
