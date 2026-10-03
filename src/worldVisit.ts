import {isScene,type Scene} from '../shared/scenes';
import {z} from 'zod';
import {releaseStorageKey} from './releaseScope';

export const WORLD_VISIT_KEY=releaseStorageKey('ek:world-visit:v1'),WORLD_VISIT_TTL=30*60_000;
type Store=Pick<Storage,'getItem'|'setItem'>;
const schema=z.object({version:z.literal(1),scene:z.string().refine(isScene),channel:z.number().int().min(1).max(3),legacy:z.boolean(),expiresAt:z.number().int().positive()}).strict();
export type WorldVisit={scene:Scene;channel:number;legacy:boolean};
// Presentation only, in this tab. Never restore a draft, proof, payment or mic.
export function readWorldVisit(storage:Store|null,navigation:string,now=Date.now()):WorldVisit|null{
  if(navigation!=='reload'&&navigation!=='back_forward')return null;
  try{
    const raw=storage?.getItem(WORLD_VISIT_KEY),parsed=raw?schema.safeParse(JSON.parse(raw)):null;
    if(parsed?.success&&parsed.data.expiresAt>now&&parsed.data.expiresAt<=now+WORLD_VISIT_TTL){const {scene,channel,legacy}=parsed.data;return {scene:scene as Scene,channel,legacy};}
  }catch{/* Private browsing can deny storage. */}
  return null;
}
export function rememberWorldVisit(storage:Store|null,visit:WorldVisit,now=Date.now()){
  try{storage?.setItem(WORLD_VISIT_KEY,JSON.stringify(schema.parse({...visit,version:1,expiresAt:now+WORLD_VISIT_TTL})));}catch{/* In-memory world remains usable. */}
}
export function browserWorldVisit(){
  try{return readWorldVisit(sessionStorage,(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type??'navigate');}catch{return null;}
}
export function saveBrowserWorldVisit(visit:WorldVisit){try{rememberWorldVisit(sessionStorage,visit);}catch{/* No storage required. */}}
