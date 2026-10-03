const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});

export function firstGrapheme(text:string){
  return graphemes.segment(text)[Symbol.iterator]().next().value?.segment??'';
}

export function graphemeExcerpt(text:string,limit:number){
  const parts:string[]=[];
  for(const part of graphemes.segment(text)){
    if(parts.length===limit)return parts.join('')+'…';
    parts.push(part.segment);
  }
  return parts.join('');
}
