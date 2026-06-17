import { RegisterForm } from "@/components/register-form";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 overflow-hidden">
      {/* blobs */}
      <div className="pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full bg-muted/60 blur-[50px] animate-float" />
      <div className="pointer-events-none absolute -bottom-16 -right-12 w-52 h-52 rounded-full bg-secondary/35 blur-[40px] animate-float-reverse" />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-5 animate-slideUp">
        <Link href="/" className="flex items-center justify-center gap-2 font-medium">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold animate-pulseRing overflow-hidden">
            <Image 
              src="/silkbot-logo-white.png"
              alt="SilkBot Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <Image 
            src="/silkbot-black.png"
            alt="SilkBot"
            width={90}
            height={28}
            className="object-contain"
          />
        </Link>
        <RegisterForm />
      </div>
    </div>
  );
}