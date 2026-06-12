import { LoginForm } from "@/components/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 overflow-hidden">
      {/* blobs */}
      <div className="pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full bg-muted/60 blur-[50px] animate-float" />
      <div className="pointer-events-none absolute -bottom-16 -right-12 w-52 h-52 rounded-full bg-secondary/35 blur-[40px] animate-float-reverse" />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-5 animate-slideUp">
        <Link href="/" className="flex items-center justify-center gap-2 font-medium">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold animate-pulseRing">
            ⚖
          </div>
          <span className="font-serif text-lg font-bold text-primary">SilkBot</span>
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}