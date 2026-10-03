import {useEffect,useState} from 'react';
export const TOUCH_LAYOUT_QUERY='(pointer: coarse), (max-width: 700px), (max-height: 500px)';
export default function useTouchLayout(){
  const [touch,setTouch]=useState(()=>matchMedia(TOUCH_LAYOUT_QUERY).matches);
  useEffect(()=>{const media=matchMedia(TOUCH_LAYOUT_QUERY),update=()=>setTouch(media.matches);media.addEventListener('change',update);update();return()=>media.removeEventListener('change',update);},[]);
  return touch;
}
