"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    authClient.getSession().then((session) => {
      const role = session?.data?.user?.role;
      router.replace(role === "admin" ? "/admin" : "/dashboard");
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirection...</p>
    </div>
  );
}