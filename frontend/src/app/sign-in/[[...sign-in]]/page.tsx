import AuthShell from "@/features/auth/components/auth-shell";
import ClerkAuthForm from "@/features/auth/components/clerk-auth-form";

export default function SignInPage() {
  return (
    <AuthShell>
      <ClerkAuthForm mode="sign-in" />
    </AuthShell>
  );
}
