import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface User {
    id?: number;
    nom: string;
    age: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: User = await request.json();
        const { nom, age } = body;

        if (!nom || !age) {
            return NextResponse.json(
                { error: 'Nom et âge sont requis' },
                { status: 400 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO utilisateurs (nom, age) VALUES (?, ?)',
            [nom, age]
        );

        return NextResponse.json({ 
            message: 'Succès',
            data: { 
                id: result.insertId,
                nom, 
                age 
            }
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, nom, age FROM utilisateurs ORDER BY id DESC LIMIT 1'
        );
        
        if (rows.length > 0) {
            return NextResponse.json({
                id: rows[0].id,
                nom: rows[0].nom,
                age: rows[0].age
            });
        }
        
        return NextResponse.json({ nom: '', age: '' });
    } catch (error) {
        console.error('Erreur:', error);
        return NextResponse.json(
            { error: 'Erreur lors de la récupération' },
            { status: 500 }
        );
    }
}