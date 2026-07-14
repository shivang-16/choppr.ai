import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import PostHogIdentify from "@/components/posthog-identify";
import { MediaCleanupProvider } from "@/components/media-cleanup-provider";

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        cssLayerName: "clerk",
      }}
      localization={{
        formFieldLabel__username: "GitHub Username",
        formFieldInputPlaceholder__username: "Enter your GitHub username",
      }}>
      <ThemeProvider
        enableSystem
        attribute={"class"}
        defaultTheme="dark"
        disableTransitionOnChange>
        <PostHogIdentify />
        <MediaCleanupProvider />
        {children}
      </ThemeProvider>
    </ClerkProvider>
  );
};

export default Providers;
