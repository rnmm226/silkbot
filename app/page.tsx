"use client";

import { Timer } from "./Timer";
import Compteur from "./input";
import Form from "./form";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <Timer initialSeconds={300} />
      <Compteur />
      <Form />

      <Link href="/login">
        <button className="border px-4 py-2 rounded">
          Go to Login
        </button>
      </Link>


    </div>
  );
}