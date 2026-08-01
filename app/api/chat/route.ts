export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { generateEmbedding } from '@/utils/embeddings';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, sessionId: inputSessionId, userId } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
        }

        let sessionId = inputSessionId;

        // Ensure session exists in Postgres & link to userId
        if (!sessionId) {
            const newSession = await prisma.chatSession.create({
                data: {
                    title: message.substring(0, 35) || 'Financial Chat',
                    userId: userId || undefined,
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
                        userId: userId || undefined,
                    }
                });
            } else if (userId && !existing.userId) {
                await prisma.chatSession.update({
                    where: { id: sessionId },
                    data: { userId }
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
- Total Inflow: $${summary.totalInflow.toLocaleString()}
- Total Outflow: $${summary.totalOutflow.toLocaleString()}
- Net Savings: $${summary.netSavings.toLocaleString()}
- Savings Rate: ${summary.savingsRatePercent}%
- Expense Breakdown: ${JSON.stringify(summary.categories)}
            `.trim();
        }

        // 3. Build System Prompt for Anthropic Claude
        const systemPrompt = `You are Finance AI, an expert, highly professional financial advisor assistant.
Your job is to assist users with personalized financial advice, bank statement analysis, budget planning, debt management, cash flow optimization, and expense control.

${summaryContext ? `### User's Financial Statement Summary:\n${summaryContext}\n` : ''}
${ragContext ? `### Relevant Line Items from User's Bank Statement:\n${ragContext}\n` : ''}

Strict Operating Rules & Guidelines:
1. STRICTLY TEXT-BASED RESPONSES:
   - Provide clean, professional text responses formatted in Markdown (headings, bold text, bullet points, numbered lists, and markdown tables when helpful).
   - NEVER generate or attempt to draw charts, graphs, SVG diagrams, ASCII graphics, or code meant to render visual plots. Output must strictly resemble standard text-based responses.

2. NON-FINANCIAL TOPIC GUARDRAIL:
   - If the user asks a question unrelated to finance, money management, banking, economics, budgeting, business, or financial decision-making (e.g. general trivia, entertainment, coding, recipes, sports, etc.), politely decline to answer that non-financial topic and guide them back to financial topics.

3. BANK STATEMENT & FINANCIAL BREAKDOWN HANDLING:
   - If the user requests personalized financial analysis or statement insights, but has NEITHER uploaded a bank statement NOR provided a text breakdown of their income/expenses in their message or context:
     -> Politely inform them that to provide precise financial guidance, you need data. Ask them to either upload their bank statement document (PDF or image) or type out their complete income and expense breakdown directly in the chat.
   - If the user types out a manual financial breakdown (e.g., listing monthly salary, rent, food, savings, debt, or specific transaction items), thoroughly analyze every line item, calculate totals, identify high-expense areas, and deliver a comprehensive, structured professional financial recommendation.

4. PROFESSIONAL TONE:
   - Always maintain an encouraging, objective, clear, and highly professional tone suitable for a certified financial advisor.`;

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
