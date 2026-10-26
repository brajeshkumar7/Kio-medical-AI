"use client";

import { KioLoadingIndicator } from "@/components/brand/kio-agent-loader";
import { SignIn, SignUp } from "@clerk/nextjs";
import { useHydrated } from "@/lib/use-hydrated";

const appearance = {
  variables: {
    colorBackground: "var(--surface-solid)",
    colorText: "var(--ink)",
    colorTextSecondary: "var(--muted)",
    colorPrimary: "var(--ink)",
    colorInputBackground: "var(--surface-solid)",
    colorInputText: "var(--ink)",
    borderRadius: "8px",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    cardBox: "clerk-card-box",
    card: "clerk-card",
    headerTitle: "clerk-title",
    headerSubtitle: "clerk-subtitle",
    formButtonPrimary: "clerk-primary-button",
    socialButtonsBlockButton: "clerk-social-button",
    footerActionLink: "clerk-link",
  },
};

export default function ClerkAuthForm({
  mode,
  onHomePage = false,
}: {
  mode: "sign-in" | "sign-up";
  onHomePage?: boolean;
}) {
  const mounted = useHydrated();

  if (!mounted) {
    return (
      <div className="auth-clerk-loading" aria-busy="true">
        <KioLoadingIndicator
          size="section"
          label="Preparing secure access..."
        />
      </div>
    );
  }

  return mode === "sign-in" ? (
    <SignIn
      path={onHomePage ? "/" : "/sign-in"}
      routing="path"
      signUpUrl="/sign-up"
      forceRedirectUrl="/console"
      appearance={appearance}
    />
  ) : (
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/"
      forceRedirectUrl="/console"
      appearance={appearance}
    />
  );
}
