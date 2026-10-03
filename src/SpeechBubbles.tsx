import { bubbleExcerpt, type SpeechBubble } from './speechBubbleState';

export type BubbleElements = Map<string, HTMLDivElement>;

// The render loops position DOM text without rebuilding textures or triggering
// a React render every frame. Text nodes (not HTML) keep public chat inert.
export function placeBubble(elements: BubbleElements, id: string, x: number, y: number, visible: boolean, width: number) {
  const el = elements.get(id);
  if (!el) return;
  el.style.visibility = visible ? 'visible' : 'hidden';
  if (!visible) return;
  const margin = Math.min(122, width / 2);
  const left = Math.max(margin, Math.min(width - margin, x));
  el.style.transform = `translate3d(${left.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
}

export default function SpeechBubbles({ bubbles, elements }: { bubbles: SpeechBubble[]; elements: BubbleElements }) {
  return <div className="speech-bubbles" aria-hidden="true">{bubbles.map(bubble =>
    <div key={bubble.sender} className="speech-bubble" data-speaker={bubble.sender} data-message-id={bubble.id}
      ref={el => { if (el) elements.set(bubble.sender, el); else elements.delete(bubble.sender); }}>
      <span dir="auto">{bubbleExcerpt(bubble.text)}</span>
    </div>
  )}</div>;
}
