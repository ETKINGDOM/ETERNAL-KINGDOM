import { AVATAR_MAX_BYTES,BLESSING_OUTPUT_SIZE,avatarSourceRect,blessingLayout,inspectAvatar,type AvatarCrop,type BlessingStyle } from './blessingAvatarLayout';

export type LocalAvatar={image:CanvasImageSource;width:number;height:number;dispose:()=>void};
export interface BlessingImagePort{
  decode(file:File):Promise<LocalAvatar>;
  draw(canvas:HTMLCanvasElement,avatar:LocalAvatar,halo:HTMLImageElement,style:BlessingStyle,crop:AvatarCrop):void;
  export(canvas:HTMLCanvasElement):Promise<Blob>;
}

export const localBlessingImages:BlessingImagePort={
  async decode(file){
    if(file.size>AVATAR_MAX_BYTES||!file.size)throw new Error('Choose an image up to 8 MB.');
    inspectAvatar(new Uint8Array(await file.arrayBuffer()),file.type);
    let image:CanvasImageSource,width:number,height:number,dispose:()=>void;
    if(typeof createImageBitmap==='function'){
      const bitmap=await createImageBitmap(file);image=bitmap;width=bitmap.width;height=bitmap.height;dispose=()=>bitmap.close();
    }else{
      const url=URL.createObjectURL(file),photo=new Image();
      try{photo.src=url;await photo.decode();}catch{URL.revokeObjectURL(url);throw new Error('This image could not be decoded. Try a different photo.');}
      image=photo;width=photo.naturalWidth;height=photo.naturalHeight;dispose=()=>{photo.src='';URL.revokeObjectURL(url);};
    }
    // Keep only a bounded local working image after orientation-aware decoding.
    const scale=Math.min(1,2048/Math.max(width,height));
    if(scale<1){
      const small=document.createElement('canvas');small.width=Math.round(width*scale);small.height=Math.round(height*scale);
      const ctx=small.getContext('2d');if(!ctx){dispose();throw new Error('Image editing is unavailable in this browser.');}
      try{ctx.drawImage(image,0,0,small.width,small.height);}finally{dispose();}
      return {image:small,width:small.width,height:small.height,dispose:()=>{small.width=small.height=0;}};
    }
    return {image,width,height,dispose};
  },
  draw(canvas,avatar,halo,style,crop){
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image editing is unavailable in this browser.');
    canvas.width=canvas.height=BLESSING_OUTPUT_SIZE;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const size=canvas.width,layout=blessingLayout(style,size),source=avatarSourceRect(avatar.width,avatar.height,crop);
    const drawHalo=(x:number,y:number,d:number)=>{
      // Reuse the owner's original bitmap. Circular clipping removes its white
      // outer corners without modifying the brand asset or using a remote API.
      ctx.save();ctx.beginPath();ctx.arc(x+d/2,y+d/2,d*.493,0,Math.PI*2);ctx.clip();
      ctx.drawImage(halo,x,y,d,d);ctx.restore();
    };
    if(style==='halo')drawHalo(0,0,size);
    ctx.save();
    if(style==='halo'){ctx.beginPath();ctx.arc(size/2,size/2,layout.radius,0,Math.PI*2);ctx.clip();}
    const p=layout.portrait;ctx.drawImage(avatar.image,source.x,source.y,source.size,source.size,p.x,p.y,p.size,p.size);ctx.restore();
    if(style==='badge'){
      const b=layout.badge;ctx.save();ctx.shadowColor='#593b2566';ctx.shadowBlur=size*.012;ctx.shadowOffsetY=size*.004;
      ctx.fillStyle='#fff8e8';ctx.beginPath();ctx.arc(b.x+b.size/2,b.y+b.size/2,b.size*.5,0,Math.PI*2);ctx.fill();ctx.restore();
      drawHalo(b.x,b.y,b.size);
    }
  },
  export(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed. Please try again.')),'image/png'));},
};

export function loadBlessingHalo():Promise<HTMLImageElement>{
  const image=new Image();image.src='/brand/blessing-halo.png';
  return image.decode().then(()=>image).catch(()=>{throw new Error('The halo could not load. Close this tool and try again.');});
}
