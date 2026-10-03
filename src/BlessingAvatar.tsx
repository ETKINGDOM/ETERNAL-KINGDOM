import { useEffect,useRef,useState,type ChangeEvent } from 'react';
import { Download,ImagePlus,RotateCcw,Trash2 } from 'lucide-react';
import { DEFAULT_AVATAR_CROP,type AvatarCrop,type BlessingStyle } from './blessingAvatarLayout';
import { localBlessingImages,loadBlessingHalo,type BlessingImagePort,type LocalAvatar } from './blessingAvatarRenderer';

export default function BlessingAvatar({images=localBlessingImages}:{images?:BlessingImagePort}){
  const [avatar,setAvatar]=useState<LocalAvatar|null>(null),[halo,setHalo]=useState<HTMLImageElement|null>(null);
  const [style,setStyle]=useState<BlessingStyle>('badge'),[crop,setCrop]=useState<AvatarCrop>(DEFAULT_AVATAR_CROP);
  const [busy,setBusy]=useState(false),[exporting,setExporting]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [haloError,setHaloError]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null),input=useRef<HTMLInputElement>(null),current=useRef<LocalAvatar|null>(null),generation=useRef(0),alive=useRef(false);
  const urls=useRef(new Set<string>()),timers=useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(()=>{
    alive.current=true;let cancelled=false;
    void loadBlessingHalo().then(image=>{if(!cancelled)setHalo(image);}).catch(e=>{if(!cancelled)setHaloError(e.message);});
    return()=>{cancelled=true;alive.current=false;generation.current++;current.current?.dispose();current.current=null;for(const timer of timers.current)clearTimeout(timer);for(const url of urls.current)URL.revokeObjectURL(url);};
  },[]);
  useEffect(()=>{
    setReady(false);
    if(!avatar||!halo||!canvas.current)return;
    try{images.draw(canvas.current,avatar,halo,style,crop);setReady(true);}catch{setError('The preview could not be drawn. Try another photo.');}
  },[avatar,halo,style,crop,images]);
  function clear(){
    generation.current++;current.current?.dispose();current.current=null;setAvatar(null);setReady(false);setBusy(false);setCrop(DEFAULT_AVATAR_CROP);setNotice('');
    if(input.current)input.current.value='';
    if(canvas.current)canvas.current.width=canvas.current.height=0;
  }
  async function choose(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    clear();setError('');setBusy(true);const request=++generation.current;
    try{
      const decoded=await images.decode(file);
      if(!alive.current||request!==generation.current){decoded.dispose();return;}
      current.current=decoded;setAvatar(decoded);
    }catch(e){if(alive.current&&request===generation.current)setError(e instanceof Error?e.message:'This image could not be read.');}
    finally{if(alive.current&&request===generation.current)setBusy(false);}
  }
  async function download(){
    if(!ready||busy||exporting||!canvas.current)return;
    setExporting(true);setError('');setNotice('');const request=generation.current;
    try{
      const blob=await images.export(canvas.current);
      if(!alive.current||request!==generation.current)return;
      const url=URL.createObjectURL(blob);urls.current.add(url);
      const a=document.createElement('a');a.href=url;a.download=`eternal-kingdom-blessing-${style}.png`;document.body.append(a);a.click();a.remove();
      setNotice('PNG download requested. If your browser opens it, save the image from there.');
      const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.current.delete(url);timers.current.delete(timer);},60000);timers.current.add(timer);
    }catch{if(alive.current)setError('PNG export failed. Please try again.');}
    finally{if(alive.current)setExporting(false);}
  }
  function adjust(key:keyof AvatarCrop,value:number){setCrop(old=>({...old,[key]:value}));setNotice('');}
  return <div className="blessing-tool">
    <p className="blessing-intro">Carry a little light with you.</p>
    <p className="blessing-privacy">Your photo stays on this device. No server upload, wallet or payment.</p>
    <div className="blessing-workspace">
      <div className="blessing-preview" aria-label="Blessing avatar preview">
        <canvas ref={canvas} aria-label="Your blessing avatar" role="img" hidden={!avatar}/>
        {!avatar&&<div className="blessing-placeholder"><img src="/brand/blessing-halo.png" alt=""/><span>{busy?'Preparing your image…':'Choose a photo to begin.'}</span></div>}
      </div>
      <div className="blessing-settings">
        <label className="blessing-file" htmlFor="blessing-photo"><ImagePlus size={18}/> Choose your avatar</label>
        <input ref={input} id="blessing-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void choose(e)} disabled={exporting} aria-describedby="blessing-file-help"/>
        <small id="blessing-file-help">PNG, JPG or WebP · up to 8 MB / 16 MP</small>
        {avatar&&<small>Photo ready. Choose again to replace it.</small>}
        <fieldset className="blessing-styles" disabled={exporting}><legend>Choose a style</legend>
          <label><input type="radio" name="blessing-style" checked={style==='badge'} onChange={()=>{setStyle('badge');setNotice('');}}/> Corner halo <small>Small mark at the upper right</small></label>
          <label><input type="radio" name="blessing-style" checked={style==='halo'} onChange={()=>{setStyle('halo');setNotice('');}}/> Halo frame <small>Your portrait in the center</small></label>
        </fieldset>
        <fieldset className="blessing-crop" disabled={!avatar||busy||exporting}><legend>Adjust your portrait</legend>
          <label>Zoom <input aria-label="Avatar zoom" type="range" min="1" max="3" step=".01" value={crop.zoom} onChange={e=>adjust('zoom',Number(e.target.value))}/></label>
          <label>Left / right <input aria-label="Avatar horizontal position" type="range" min="-1" max="1" step=".01" value={crop.x} onChange={e=>adjust('x',Number(e.target.value))}/></label>
          <label>Up / down <input aria-label="Avatar vertical position" type="range" min="-1" max="1" step=".01" value={crop.y} onChange={e=>adjust('y',Number(e.target.value))}/></label>
          <button type="button" className="blessing-reset" onClick={()=>{setCrop(DEFAULT_AVATAR_CROP);setNotice('');}}><RotateCcw size={14}/> Reset crop</button>
        </fieldset>
      </div>
    </div>
    {(error||haloError)&&<p className="error" role="alert">{error||haloError}</p>}
    {busy&&<p role="status">Preparing your image locally…</p>}
    <div className="blessing-actions"><button className="primary" disabled={!ready||busy||exporting} onClick={()=>void download()}><Download size={17}/>{exporting?'Preparing PNG…':'Download PNG'}</button><button type="button" className="blessing-reset" disabled={exporting||!avatar&&!busy} onClick={()=>{clear();setError('');}}><Trash2 size={15}/> Remove photo</button></div>
    {notice&&<p role="status" className="blessing-notice">{notice}</p>}
    <p className="blessing-footnote">1024 × 1024 PNG · creative avatar artwork · original photo metadata is not copied. Closing removes your photo from this tool.</p>
  </div>;
}
