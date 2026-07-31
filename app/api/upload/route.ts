export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { analyzeTransactions, Transaction } from '@/utils/financialRules';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfData = await pdfParse(buffer);
        const rawText = pdfData.text;

        const lines = rawText.split('\n');
        const detectedTransactions: Transaction[] = [];

        lines.forEach((line: string) => {
            // Basic regex to pick up numbers/amounts in a bank statement transaction line
            const amountMatch = line.match(/(\d{1,3}(,\d{3})*(\.\d{2})?)/);
            if (amountMatch) {
                const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
                const isDebit = line.toLowerCase().includes('debit') || line.includes('-');

                detectedTransactions.push({
                    date: new Date().toISOString().split('T')[0],
                    description: line.substring(0, 50).trim(),
                    amount: amount,
                    type: isDebit ? 'debit' : 'credit'
                });
            }
        });

        // Run the structured math through our rules engine
        const financialSummary = analyzeTransactions(detectedTransactions);

        return NextResponse.json({ summary: financialSummary });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to parse statement' }, { status: 500 });
    }
}