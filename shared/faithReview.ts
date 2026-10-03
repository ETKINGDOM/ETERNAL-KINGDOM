import type { RecordKind } from './adapters';

// Provisional local-alpha limits, not a chain limit or a Gas quote. A future
// record adapter must validate its actual serialized payload before signing.
export const FAITH_TEXT_LIMITS={characters:2000,utf8Bytes:4000} as const;
export const FAITH_ENCRYPTION_SIZES={tag:16,iv:12} as const;

export function analyzeFaithText(input:string){
  const text=input.trim();
  const characters=Array.from(text).length;
  const bytes=new TextEncoder().encode(text).byteLength;
  const malformed=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
  const error=!text?'Write a few words to begin.':malformed?'Some characters could not be read. Please replace them.':
    characters>FAITH_TEXT_LIMITS.characters?'Keep this local preview within 2,000 characters.':
      bytes>FAITH_TEXT_LIMITS.utf8Bytes?'Keep this local preview within 4,000 UTF-8 bytes. Different languages use different byte counts.':null;
  return {text,characters,bytes,ciphertextBytes:bytes+FAITH_ENCRYPTION_SIZES.tag,error,valid:error===null};
}

export function requireFaithText(input:string):string{
  const review=analyzeFaithText(input);
  if(!review.valid)throw new Error(review.error!);
  return review.text;
}

export function faithVisibilityDefaults(kind:RecordKind){
  return {anonymous:kind!=='prayer',encrypted:kind!=='prayer'};
}

// Only the presenter's projection may be passed to a future public screen.
// Anonymous names and encrypted words never enter that projection in full.
export function faithScreenPreview(input:{name:string;text:string;anonymous:boolean;encrypted:boolean}){
  const name=input.name.trim();
  const initial=new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(name)[Symbol.iterator]().next().value?.segment;
  return {
    name:input.anonymous?(initial?`${initial}*****`:'Anonymous'):name||'Pilgrim',
    words:input.encrypted?'*****':input.text.trim(),
  };
}
