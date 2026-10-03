// Shared, allowlisted map catalog. A map is a room; a landmark is not.
export const SCENES=['plaza','temple','cedar','lake','cloister','market'] as const;
export type Scene=typeof SCENES[number];
export const isScene=(value:unknown):value is Scene=>typeof value==='string'&&SCENES.some(s=>s===value);
export const isScenic=(scene:Scene)=>scene!=='plaza'&&scene!=='temple';
export const SCENE_INFO:Record<Scene,{name:string;caption:string;subtitle:string}>={
  plaza:{name:'The Heavenly Gardens',caption:'THE FIRST WORLD',subtitle:'You are welcome here.'},
  temple:{name:'The First Sanctuary',caption:'A MOMENT BEYOND THE EVERYDAY',subtitle:'Let your words begin in silence.'},
  cedar:{name:'Cedar Valley',caption:'BEYOND THE GARDENS · EXPLORATION',subtitle:'Follow the stream beneath the trees.'},
  lake:{name:'Mirror Lake',caption:'BEYOND THE GARDENS · EXPLORATION',subtitle:'Water, open sky, and a quiet path.'},
  cloister:{name:'The Cloud Cloister',caption:'BEYOND THE GARDENS · EXPLORATION',subtitle:'Walk the colonnades above the clouds.'},
  market:{name:'The Market Street',caption:'BEYOND THE GARDENS · EXPLORATION',subtitle:'Along the arcades, a world waiting to awaken.'},
};
export type MapPortal={id:string;from:Scene;to:Scene;x:number;y:number;yaw:number};
export const MAP_PORTALS:MapPortal[]=[
  {id:'cedar-gate',from:'plaza',to:'cedar',x:1080,y:580,yaw:Math.PI/2},
  {id:'lake-gate',from:'plaza',to:'lake',x:125,y:590,yaw:Math.PI/2},
  {id:'cloister-gate',from:'plaza',to:'cloister',x:825,y:800,yaw:0},
  {id:'market-gate',from:'plaza',to:'market',x:375,y:800,yaw:0},
  ...(['cedar','lake','cloister','market'] as const).map(from=>({id:`${from}-return`,from,to:'plaza' as const,x:600,y:765,yaw:0})),
];
export const portalsFor=(scene:Scene)=>MAP_PORTALS.filter(p=>p.from===scene);
export const PORTAL_TRIGGER_RADIUS=.7;
export function portalAt(scene:Scene,point:{x:number;y:number}){
  return portalsFor(scene).find(p=>Math.hypot((p.x-point.x)*.04,(p.y-point.y)*.07)<PORTAL_TRIGGER_RADIUS);
}
export function parseRoomPath(path:string):{scene:Scene;channel:number}|null{
  const match=/^\/api\/rooms\/([a-z]+)\/([1-3])$/.exec(path);
  return match&&isScene(match[1])?{scene:match[1],channel:Number(match[2])}:null;
}
