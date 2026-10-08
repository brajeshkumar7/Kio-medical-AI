import AuthShell from "@/components/auth-shell";
import ClerkAuthForm from "@/components/clerk-auth-form";


export default function SignUpPage() {
  return (
    <AuthShell>
      <ClerkAuthForm mode="sign-up" />
    </AuthShell>
  );
}
