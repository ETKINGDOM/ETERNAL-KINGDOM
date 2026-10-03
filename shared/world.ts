import { SANCTUARY_PLACES } from './places';
import { isScenic, type Scene } from './scenes';
import { streetBlocked } from './market';
export type { Scene } from './scenes';
export type Point = { x: number; y: number };
export const WORLD = { width: 1200, height: 860 } as const;
export const SPAWN: Record<Scene, Point> = { plaza: { x: 600, y: 650 }, temple: { x: 600, y: 680 }, cedar:{x:600,y:680},lake:{x:600,y:680},cloister:{x:600,y:680},market:{x:600,y:680} };
export const COLORS = ['#d9b775', '#9ebfaa', '#ada2ce', '#d19c88', '#9ab9cd', '#eee2c6'] as const;
export const ROOM_CAPACITY = 32;
export function spawnPosition(scene:Scene,slot:number):Point{
  const offsets=[0,38,-38,76,-76];
  // Scenic arrivals spread forward, away from the return arch behind them.
  return {x:SPAWN[scene].x+offsets[slot%offsets.length],y:SPAWN[scene].y+(isScenic(scene)?-1:1)*Math.floor(slot/5)*14};
}
export const CHAT_TTL = 15 * 60_000;
export const CHAT_LIMIT = 40;
export const SANCTUARY_GATE = { x:600, y:190, halfWidth:66 } as const;
export const MOVEMENT_SPEED = {walk:3.7,run:6.2} as const;
export const VISIT_AREAS = [
  {id:'garden',name:'Quiet Garden',description:'Trees, shade and a place to be still.',x:990,y:360,left:850,right:1140,top:240,bottom:620},
  {id:'river',name:'Living Water Walk',description:'Follow the water and cross the little bridge.',x:280,y:410,left:60,right:350,top:240,bottom:620},
  {id:'terrace',name:'Horizon Terrace',description:'An open view beyond the gardens.',x:600,y:815,left:200,right:1000,top:730,bottom:845},
] as const;
export const RIVER_CHANNEL={left:165,right:220,top:260,bottom:540,bridgeTop:390,bridgeBottom:430} as const;
export function visitAreaAt(p:Point){return VISIT_AREAS.find(a=>p.x>=a.left&&p.x<=a.right&&p.y>=a.top&&p.y<=a.bottom);}

export function atSanctuaryGate(scene:Scene,p:Point):boolean {
  return !isScenic(scene)&&walkable(scene,p)&&Math.abs(p.x-600)<SANCTUARY_GATE.halfWidth&&(scene==='plaza'?p.y<=198:p.y>=770);
}

// Presentation-only elevation follows the nine real stair treads. Networking
// still uses the shared horizontal coordinate system and collision validation.
export function groundHeight(scene:Scene,p:Point):number {
  if(scene!=='plaza'||p.y>346||Math.abs(p.x-600)>300)return 0;
  const z=(p.y-575)*.07;
  return Math.min(9,Math.max(0,Math.floor((-z-16)/.6)+1))*.29;
}

export function sanctuaryApproach(from:Point):Point[] {
  const goal={x:SANCTUARY_GATE.x,y:SANCTUARY_GATE.y};
  if(canTravel('plaza',from,goal))return [goal];
  // Use either side aisle around the fountain, never a teleport through it.
  const candidates=[390,810].flatMap(x=>[
    [{x,y:530},{x,y:360},{x:600,y:330},goal],
    [{x,y:360},{x:600,y:330},goal],
  ]).filter(points=>points.every((p,i)=>canTravel('plaza',i?points[i-1]:from,p)));
  const distance=(points:Point[])=>points.reduce((sum,p,i)=>{const previous=i?points[i-1]:from;return sum+Math.hypot((p.x-previous.x)*.04,(p.y-previous.y)*.07);},0);
  return candidates.sort((a,b)=>distance(a)-distance(b))[0]??[];
}

// Shared with the server: collision and visual floor bounds use the same units.
export function walkable(scene: Scene, point: Point): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if(isScenic(scene)){
    if(point.x<140||point.x>1060||point.y<180||point.y>795)return false;
    if(scene==='cedar'&&point.y>410&&point.y<465&&Math.abs(point.x-600)>80)return false;
    if(scene==='lake'&&((point.x-600)/310)**2+((point.y-430)/150)**2<1&&Math.abs(point.x-600)>38)return false;
    if(scene==='market'&&streetBlocked((point.x-600)*.04,(point.y-575)*.07))return false;
    return true;
  }
  if(scene==='temple'&&SANCTUARY_PLACES.some(p=>Math.hypot((point.x-p.x)*.04,(point.y-p.y)*.07)<.95))return false;
  if(scene==='plaza'&&visitAreaAt(point)){
    // Side districts cannot enter the solid sides of the existing stair stack.
    if(point.y<346&&point.x>260&&point.x<940)return false;
    const r=RIVER_CHANNEL;
    if(point.x>=r.left&&point.x<=r.right&&point.y>=r.top&&point.y<=r.bottom&&!(point.y>=r.bridgeTop&&point.y<=r.bridgeBottom))return false;
    return true;
  }
  if(scene==='plaza'&&point.y>=177&&point.y<365){
    const halfWidth=point.y<220?82:Math.min(300,100+(point.y-220)*1.5);
    return Math.abs(point.x-600)<=halfWidth;
  }
  // Matched to the celestial scene assets, not the old placeholder geometry.
  const edge = scene === 'plaza' ? Math.max(95, 300 - (point.y - 365) * 1.5) : Math.max(210, 370 - (point.y - 365) * .38);
  if (point.x < edge || point.x > 1200 - edge || point.y < 365 || point.y > 785) return false;
  if (scene === 'plaza' && ((point.x - 600) / 168) ** 2 + ((point.y - 444) / 47) ** 2 < 1) return false;
  return true;
}
export function canTravel(scene: Scene, from: Point, to: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8));
  if (steps > 220) return false;
  for (let i = 1; i <= steps; i++) {
    if (!walkable(scene, { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps })) return false;
  }
  return true;
}
