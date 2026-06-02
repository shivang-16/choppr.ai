import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; scheme?: string; port?: string }>;
}) {
  // Await searchParams in Next.js 15+
  const params = await searchParams;
  
  // Check if this is an extension login
  const isExtensionAuth = params.source === "extension";
  const scheme = params.source === "extension" ? params.scheme : undefined;
  
  // Check if this is a CLI login
  const isCliAuth = params.source === "cli";
  const port = params.source === "cli" ? params.port : undefined;

  // Construct callback URL based on source
  let callbackUrl: string | undefined;
  
  if (isExtensionAuth) {
    callbackUrl = `/extension-auth-callback${scheme ? `?scheme=${scheme}` : ''}`;
  } else if (isCliAuth && port) {
    callbackUrl = `/cli-auth-callback?port=${port}`;
  } else {
    callbackUrl = "/dashboard";
  }

  return (
    <div className="bg-foreground flex w-full min-h-screen items-center justify-center p-6 md:p-10">
      <SignIn
        // If logging in from extension or CLI, redirect to appropriate callback after auth
        forceRedirectUrl={callbackUrl}
      />
    </div>
  );
}
