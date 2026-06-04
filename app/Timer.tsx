"use client";


import React, { useState, useEffect } from "react";

export function Timer({ initialSeconds }: { initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Compteur de temps</h2>
      <p>{seconds} secondes</p>
    </div>
  );
}
