export const AVATAR_MAX_BYTES=8*1024*1024;
export const AVATAR_MAX_PIXELS=16_000_000;
export const BLESSING_OUTPUT_SIZE=1024;
export type BlessingStyle='badge'|'halo';
export type AvatarCrop={zoom:number;x:number;y:number};
export const DEFAULT_AVATAR_CROP:AvatarCrop={zoom:1,x:0,y:0};

function ascii(data:Uint8Array,start:number,length:number){return String.fromCharCode(...data.subarray(start,start+length));}
// Check dimensions before decoding a potentially very large compressed photo.
// The browser decoder still validates the complete image and honours orientation.
export function inspectAvatar(data:Uint8Array,mime:string){
  if(!data.length||data.length>AVATAR_MAX_BYTES)throw new Error('Choose an image up to 8 MB.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  let width=0,height=0,format='';
  if(data.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v)&&ascii(data,12,4)==='IHDR'){
    format='image/png';width=view.getUint32(16);height=view.getUint32(20);
  }else if(data.length>=4&&data[0]===255&&data[1]===216){
    format='image/jpeg';let p=2;
    while(p+3<data.length){
      if(data[p++]!==255)break;
      while(p<data.length&&data[p]===255)p++;
      const marker=data[p++];
      if(marker===217||marker===218)break;
      if(marker===1||marker>=208&&marker<=215)continue;
      if(p+2>data.length)break;
      const length=view.getUint16(p);if(length<2||p+length>data.length)break;
      if(marker>=192&&marker<=207&&![196,200,204].includes(marker)&&length>=8){height=view.getUint16(p+3);width=view.getUint16(p+5);break;}
      p+=length;
    }
  }else if(data.length>=30&&ascii(data,0,4)==='RIFF'&&ascii(data,8,4)==='WEBP'){
    format='image/webp';const chunk=ascii(data,12,4);
    if(chunk==='VP8X'){
      if(data[20]&2)throw new Error('Choose a still image, not an animated WebP.');
      width=1+data[24]+(data[25]<<8)+(data[26]<<16);height=1+data[27]+(data[28]<<8)+(data[29]<<16);
    }else if(chunk==='VP8L'&&data[20]===47){width=1+data[21]+((data[22]&63)<<8);height=1+(data[22]>>6)+(data[23]<<2)+((data[24]&15)<<10);}
    else if(chunk==='VP8 '&&data[23]===157&&data[24]===1&&data[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}
  }
  if(!format||mime&&mime!==format)throw new Error('Choose a PNG, JPG or WebP image. SVG and other file types are not supported.');
  if(!width||!height)throw new Error('This image could not be read. Try another PNG, JPG or WebP.');
  if(width>8192||height>8192||width*height>AVATAR_MAX_PIXELS)throw new Error('This image is too large. Use up to 16 megapixels and 8,192 pixels per side.');
  return {width,height,format};
}

export function avatarSourceRect(width:number,height:number,crop:AvatarCrop){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid image dimensions.');
  const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
  const size=Math.min(width,height)/clamp(crop.zoom,1,3);
  return {x:(width-size)*(clamp(crop.x,-1,1)+1)/2,y:(height-size)*(clamp(crop.y,-1,1)+1)/2,size};
}

export function blessingLayout(style:BlessingStyle,size=BLESSING_OUTPUT_SIZE){
  return style==='badge'?{badge:{x:size*.72,y:size*.03,size:size*.25},portrait:{x:0,y:0,size},radius:0}:
    {badge:{x:0,y:0,size},portrait:{x:size*.226,y:size*.226,size:size*.548},radius:size*.274};
}
