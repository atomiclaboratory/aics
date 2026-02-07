import { logger } from '../../utils/logger';

export interface LLMConfig {
    provider: 'openai' | 'gemini';
    apiKey: string;
    model?: string;
}

const SYSTEM_PROMPT = "You are a documentation summarizer. Provide a SINGLE, concise sentence summarizing the core purpose of this document. Do not use conversational filler.";

export async function summarizeContent(text: string, config: LLMConfig): Promise<string> {
    if (!config.apiKey) return '';
    
    // Truncate text to avoid token limits (e.g., 4000 chars ~1000 tokens, safe for most small models)
    const truncatedText = text.slice(0, 8000); 

    try {
        if (config.provider === 'openai') {
            return await summarizeOpenAI(truncatedText, config);
        } else if (config.provider === 'gemini') {
            return await summarizeGemini(truncatedText, config);
        }
    } catch (e: any) {
        logger.warn(`LLM Summarization failed: ${e.message}`);
        return '';
    }
    return '';
}

async function summarizeOpenAI(text: string, config: LLMConfig): Promise<string> {
    const model = config.model || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Summarize this:\n\n${text}` }
            ],
            max_tokens: 60
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

async function summarizeGemini(text: string, config: LLMConfig): Promise<string> {
    const model = config.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `${SYSTEM_PROMPT}\n\nDocument:\n${text}` }]
            }],
            generationConfig: {
                maxOutputTokens: 60
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}
