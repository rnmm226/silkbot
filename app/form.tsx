"use client";

import { useState } from 'react';

export default function Form() {
  const [nom, setNom] = useState('');
  const [age, setAge] = useState('');
  const [data, setData] = useState({ nom: '', age: '' });

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    
    await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ nom, age }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const res = await fetch('/api/submit');
    const result = await res.json();
    setData(result);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input 
          placeholder="Nom" 
          value={nom} 
          onChange={(e) => setNom(e.target.value)} 
        />
        <input 
          placeholder="Age" 
          value={age} 
          onChange={(e) => setAge(e.target.value)} 
        />
        <button type="submit" className="border px-4 py-2 rounded">Envoyer</button>
      </form>
      
      {data.nom && (
        <div>
          <h3>Données soumises :</h3>
          <p>Nom : {data.nom}</p>
          <p>Age : {data.age}</p>
        </div>
      )}
    </div>
  );
}