"use client";

import { useState } from "react";

export default function Compteur() {
  // Déclare un état pour stocker la valeur du compteur
  const [valeur, setValeur] = useState<number>(0);

  // Fonctions pour modifier la valeur
  const incrementer = () => setValeur(prev => prev + 1);
  const decrementer = () => setValeur(prev => prev - 1);

  // Gérer la saisie manuelle dans l'input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nouvelleValeur = parseInt(e.target.value, 10);
    if (!isNaN(nouvelleValeur)) {
      setValeur(nouvelleValeur);
    } else {
      setValeur(0); // Valeur par défaut si l'utilisateur efface tout
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button onClick={decrementer}>-</button>
      <input 
        type="number" 
        value={valeur} 
        onChange={handleChange} 
        style={{ width: '60px', textAlign: 'center' }}
      />
      <button onClick={incrementer}>+</button>
    </div>
  );
}
