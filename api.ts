import { GoogleGenAI } from '@google/genai';

export function getAiClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}
