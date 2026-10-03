// Preserve the founding text, but never interpret it as raw HTML or script.
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function whitepaperHtml(markdown:string):string {
  const lines=markdown.split(/\r?\n/),body:string[]=[],chapters:{id:string;title:string}[]=[];
  let paragraph:string[]=[],firstTitle=true;
  const flush=()=>{if(paragraph.length){body.push(`<p>${escape(paragraph.join(' '))}</p>`);paragraph=[];}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line||line==='<!-- page -->'){flush();continue;}
    const heading=line.match(/^(#{1,3})\s+(.+)$/);
    if(heading){
      flush();let level=heading[1].length+1,id='';
      if(heading[1].length===1){
        if(firstTitle){level=1;firstTitle=false;}
        else{const chapter={id:`chapter-${chapters.length+1}`,title:heading[2]};chapters.push(chapter);id=` id="${chapter.id}"`;level=2;}
      }
      body.push(`<h${level}${id}>${escape(heading[2])}</h${level}>`);continue;
    }
    if(line.startsWith('|')&&/^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[i+1]?.trim()??'')){
      flush();const cells=(row:string)=>row.trim().slice(1,-1).split('|').map(s=>s.trim());
      const headers=cells(line),rows:string[]=[];i+=2;
      while(i<lines.length&&lines[i].trim().startsWith('|')){const values=cells(lines[i]);if(values.length!==headers.length)throw Error('Whitepaper table columns do not match.');rows.push(`<tr>${values.map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`);i++;}i--;
      body.push(`<div class="table-scroll" role="region" aria-label="${escape(headers[0])} table" tabindex="0"><table><thead><tr>${headers.map(v=>`<th scope="col">${escape(v)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);continue;
    }
    paragraph.push(line);
  }
  flush();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Eternal Kingdom's English founding whitepaper: the dream, the calling, and a world dedicated to faith, peace and enduring hope."><title>Eternal Kingdom · Whitepaper V1</title><link rel="stylesheet" href="/whitepaper.css"></head>
<body><header><a class="brand" href="/" aria-label="Eternal Kingdom home"><img src="/brand/logo.jpg" width="36" height="36" alt="">ETERNAL KINGDOM</a><a href="/">Return to the world</a></header>
<main><div class="edition">FOUNDING EDITION · ENGLISH · SEPTEMBER 2026</div><p class="tagline">One Creator. Many Traditions. One Eternal Kingdom.</p>
<div class="document-actions"><a class="download" href="/whitepaper/Eternal_Kingdom_Whitepaper_V1.pdf" download="Eternal_Kingdom_Whitepaper_V1.pdf">Download PDF</a><a href="#whitepaper-body">Read the whitepaper ↓</a></div>
<aside aria-label="Edition and current alpha"><strong>About this edition</strong><p>The original V1 founding vision is preserved below and in the PDF. It is not a list of features already delivered.</p><p>Since this edition, the alpha has moved to 3D. Prayer has no God-token fee; onchain confession and praise require holding at least 1 whole God, without a token payment or burn. Onchain submissions still require the user's wallet confirmation and ETH network fees. The early payment and 2.5D proposals below are historical, not the current rules.</p></aside>
<nav aria-label="Whitepaper contents"><h2>Contents</h2><ol>${chapters.map(c=>`<li><a href="#${c.id}">${escape(c.title)}</a></li>`).join('')}</ol></nav>
<article id="whitepaper-body">${body.join('\n')}</article></main><footer>Founding vision and product blueprint · Version 1<br><a href="/">Return to Eternal Kingdom</a></footer></body></html>`;
}
