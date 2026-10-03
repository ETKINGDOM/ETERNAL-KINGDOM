import type { ChatMessage } from '../shared/protocol';
import { graphemeExcerpt } from './textPresentation';

export const SPEECH_BUBBLE_MS = 8000;
export type SpeechBubble = ChatMessage & { expiresAt: number };

// Only call for a server-confirmed live public chat packet, never welcome/history.
export function receiveSpeech(old: SpeechBubble[], message: ChatMessage, now: number): SpeechBubble[] {
  return [...old.filter(b => b.sender !== message.sender && b.expiresAt > now),
    { ...message, expiresAt: now + SPEECH_BUBBLE_MS }].slice(-32);
}

export function bubbleExcerpt(text: string): string {
  return graphemeExcerpt(text.replace(/\s+/gu,' ').trim(),120);
}
