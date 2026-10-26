import AuthShell from "@/features/auth/components/auth-shell";
import ClerkAuthForm from "@/features/auth/components/clerk-auth-form";

export default function SignUpPage() {
  return (
    <AuthShell>
      <ClerkAuthForm mode="sign-up" />
    </AuthShell>
  );
}
