export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { analyzeTransactions, Transaction } from '@/utils/financialRules';
import { generateBatchEmbeddings } from '@/utils/embeddings';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        let sessionId = formData.get('sessionId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
        }

        // Ensure session exists in Postgres
        if (!sessionId || sessionId === 'default-session') {
            const newSession = await prisma.chatSession.create({
                data: {
                    title: `Statement: ${file.name}`,
                }
            });
            sessionId = newSession.id;
        } else {
            const existing = await prisma.chatSession.findUnique({ where: { id: sessionId } });
            if (!existing) {
                await prisma.chatSession.create({
                    data: {
                        id: sessionId,
                        title: `Statement: ${file.name}`,
                    }
                });
            }
        }

        // Parse PDF file using pdf-parse v2.4+ PDFParse class
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const parser = new PDFParse({ data: uint8Array });
        const textResult = await parser.getText();
        const rawText = textResult.text || '';
        await parser.destroy();

        const lines = rawText
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 5); // Filter noise lines

        const detectedTransactions: Transaction[] = [];

        for (const line of lines) {
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
        }

        // Generate vector embeddings in batch via Voyage AI (chunks of max 50 lines)
        const batchSize = 50;
        for (let i = 0; i < lines.length; i += batchSize) {
            const chunkLines = lines.slice(i, i + batchSize);
            try {
                const embeddings = await generateBatchEmbeddings(chunkLines, 'document');

                for (let j = 0; j < chunkLines.length; j++) {
                    const lineText = chunkLines[j];
                    const vector = embeddings[j];

                    if (vector && vector.length > 0) {
                        const embeddingVectorString = `[${vector.join(',')}]`;
                        await prisma.$executeRaw`
                            INSERT INTO "DocumentChunk" (id, "sessionId", content, embedding)
                            VALUES (
                                gen_random_uuid(), 
                                ${sessionId}, 
                                ${lineText}, 
                                ${embeddingVectorString}::vector
                            );
                        `;
                    }
                }
            } catch (batchErr) {
                console.warn(`Warning: Batch embedding failed for lines ${i} to ${i + batchSize}:`, batchErr);
            }
        }

        // Calculate financial statistics using financial rules engine
        const financialSummary = analyzeTransactions(detectedTransactions);

        // Upsert summary to Postgres
        await prisma.financialSummary.upsert({
            where: { sessionId: sessionId },
            update: {
                totalInflow: financialSummary.totalInflow,
                totalOutflow: financialSummary.totalOutflow,
                netSavings: financialSummary.netSavings,
                savingsRatePercent: financialSummary.savingsRatePercent,
                categories: financialSummary.categories,
            },
            create: {
                sessionId: sessionId,
                totalInflow: financialSummary.totalInflow,
                totalOutflow: financialSummary.totalOutflow,
                netSavings: financialSummary.netSavings,
                savingsRatePercent: financialSummary.savingsRatePercent,
                categories: financialSummary.categories,
            }
        });

        // Record document upload message in session history
        await prisma.message.create({
            data: {
                sessionId: sessionId,
                sender: 'USER',
                text: `Uploaded bank statement file: ${file.name}`,
                fileName: file.name
            }
        });

        return NextResponse.json({
            success: true,
            sessionId: sessionId,
            summary: financialSummary,
            chunkCount: lines.length
        });
    } catch (error: unknown) {
        console.error("Upload Route Failure:", error);
        const detail = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: 'Failed to parse statement and store vectors in database', details: detail }, { status: 500 });
    }
}