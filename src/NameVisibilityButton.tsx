import { Eye, EyeOff } from 'lucide-react';

export default function NameVisibilityButton({show,toggle}:{show:boolean;toggle:()=>void}){
  return <button aria-label={show?'Hide player names':'Show player names'} aria-pressed={!show}
    title="Show or hide player nameplates. NPC names always remain visible. Chat and identity are unchanged." onClick={toggle}>
    {show?<Eye size={14}/>:<EyeOff size={14}/>}<span>{show?'Hide names':'Show names'}</span>
  </button>;
}
