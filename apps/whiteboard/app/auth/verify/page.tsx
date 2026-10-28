"use client";

import { useEffect, type ReactElement } from "react";
import { useRouter } from "next/navigation";

const VerifyPage = (): ReactElement => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <main className="whiteboard-shell flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
    </main>
  );
};

export default VerifyPage;
