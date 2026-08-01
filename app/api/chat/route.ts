export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { generateEmbedding } from '@/utils/embeddings';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, sessionId: inputSessionId } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
        }

        let sessionId = inputSessionId;

        // Ensure session exists in Postgres
        if (!sessionId) {
            const newSession = await prisma.chatSession.create({
                data: {
                    title: message.substring(0, 35) || 'Financial Chat',
                }
            });
            sessionId = newSession.id;
        } else {
            const existing = await prisma.chatSession.findUnique({ where: { id: sessionId } });
            if (!existing) {
                await prisma.chatSession.create({
                    data: {
                        id: sessionId,
                        title: message.substring(0, 35) || 'Financial Chat',
                    }
                });
            }
        }

        // Save User Message to database
        await prisma.message.create({
            data: {
                sessionId: sessionId,
                sender: 'USER',
                text: message,
            }
        });

        // 1. Perform RAG: Get Voyage AI vector embedding for user query
        let ragContext = '';
        try {
            const queryEmbedding = await generateEmbedding(message, 'query');
            const embeddingVectorString = `[${queryEmbedding.join(',')}]`;

            // Query top 5 most relevant document chunks using pgvector cosine distance
            const relevantChunks: Array<{ content: string }> = await prisma.$queryRaw`
                SELECT content
                FROM "DocumentChunk"
                WHERE "sessionId" = ${sessionId}
                ORDER BY embedding <=> ${embeddingVectorString}::vector
                LIMIT 5;
            `;

            if (relevantChunks && relevantChunks.length > 0) {
                ragContext = relevantChunks.map(c => `- ${c.content}`).join('\n');
            }
        } catch (vectorErr) {
            console.warn('Vector retrieval notice (proceeding without document context):', vectorErr);
        }

        // 2. Fetch financial summary if available
        let summaryContext = '';
        const summary = await prisma.financialSummary.findUnique({ where: { sessionId: sessionId } });
        if (summary) {
            summaryContext = `
Financial Summary Overview:
- Total Inflow: ₦${summary.totalInflow.toLocaleString()}
- Total Outflow: ₦${summary.totalOutflow.toLocaleString()}
- Net Savings: ₦${summary.netSavings.toLocaleString()}
- Savings Rate: ${summary.savingsRatePercent}%
- Expense Breakdown: ${JSON.stringify(summary.categories)}
            `.trim();
        }

        // 3. Build System Prompt for Anthropic Claude
        const systemPrompt = `You are Finance AI, an expert professional financial advisor assistant.
Your job is to assist users with personalized financial advice, bank statement breakdown, budgeting strategies, and expense management.

${summaryContext ? `### User's Financial Statement Summary:\n${summaryContext}\n` : ''}
${ragContext ? `### Relevant Line Items from User's Bank Statement:\n${ragContext}\n` : ''}

Instructions:
- Provide clear, actionable, accurate financial insights.
- If asked specific questions about their bank statement, cite figures from the provided context.
- Keep responses professional, encouraging, concise, and formatted clearly using Markdown.
- If no bank statement is attached or context is missing for a question, provide best-practice financial guidance.`;

        // 4. Retrieve recent message history from DB (up to 10 previous messages)
        const pastMessages = await prisma.message.findMany({
            where: { sessionId: sessionId },
            orderBy: { createdAt: 'asc' },
            take: 10,
        });

        const formattedMessages = pastMessages.map((msg: { sender: string; text: string }) => ({
            role: (msg.sender === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.text,
        }));

        // Fallback to current message if formattedMessages is empty
        if (formattedMessages.length === 0) {
            formattedMessages.push({ role: 'user', content: message });
        }

        // 5. Stream Claude AI response using Vercel AI SDK & Anthropic Provider
        const result = streamText({
            model: anthropic('claude-3-5-sonnet-latest'),
            system: systemPrompt,
            messages: formattedMessages,
            onFinish: async ({ text }) => {
                if (sessionId && text) {
                    try {
                        await prisma.message.create({
                            data: {
                                sessionId: sessionId,
                                sender: 'AI',
                                text: text,
                            }
                        });
                    } catch (dbErr) {
                        console.error('Failed to save AI response message to DB:', dbErr);
                    }
                }
            }
        });

        return result.toTextStreamResponse({
            headers: {
                'x-session-id': sessionId,
            }
        });

    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: 'Internal chat server error' }, { status: 500 });
    }
}
