"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  nom: string;
  email: string;
}

export function useAuth(redirectTo: string = "/login") {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const userData = localStorage.getItem("user");
      
      if (!userData) {
        if (redirectTo) {
          router.push(redirectTo);
        }
        setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        console.error("Erreur d'authentification:", error);
        localStorage.removeItem("user");
        if (redirectTo) {
          router.push(redirectTo);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, redirectTo]);

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  };

  return { user, loading, logout };
}