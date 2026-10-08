import AuthShell from "@/components/auth-shell";
import ClerkAuthForm from "@/components/clerk-auth-form";


export default function SignInPage() {
  return (
    <AuthShell>
      <ClerkAuthForm mode="sign-in" />
    </AuthShell>
  );
}
