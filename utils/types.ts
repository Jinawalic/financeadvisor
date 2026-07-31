export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    fileName?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
}
