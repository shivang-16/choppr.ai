import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; scheme?: string; port?: string }>;
}) {
  // Await searchParams in Next.js 15+
  const params = await searchParams;
  
  // Check if this is an extension sign-up
  const isExtensionAuth = params.source === "extension";
  const scheme = params.source === "extension" ? params.scheme : undefined;
  
  // Check if this is a CLI sign-up
  const isCliAuth = params.source === "cli";
  const port = params.source === "cli" ? params.port : undefined;

  // Construct callback URL based on source
  let callbackUrl: string;
  
  if (isExtensionAuth) {
    callbackUrl = `/extension-auth-callback${scheme ? `?scheme=${scheme}` : ''}`;
  } else if (isCliAuth && port) {
    callbackUrl = `/cli-auth-callback?port=${port}`;
  } else {
    callbackUrl = "/early-access";
  }

  return (
    <div className="bg-foreground flex w-full min-h-screen items-center justify-center p-6 md:p-10">
      <SignUp
        // If signing up from extension or CLI, redirect to appropriate callback after auth
        // Otherwise, redirect to early access page
        forceRedirectUrl={callbackUrl}
      />
    </div>
  );
}
