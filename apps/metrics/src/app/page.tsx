"use client";

import { useEffect, useState } from "react";
import { getAuth } from "@/lib/api";
import { LoginForm } from "@/components/LoginForm";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(!!getAuth());
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/45">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />;
  }

  return <Dashboard onLogout={() => setAuthed(false)} />;
}
