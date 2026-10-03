// Metres in the scene's local X/Z plane. Rendering and authoritative collision
// consume the same footprints; stable IDs reserve future interiors/commerce.
export type StreetFootprint={x:number;z:number;width:number;depth:number};
export type StreetDoor={id:string;x:number;z:number;approach:{x:number;z:number};interiorId:string|null;state:'closed'};
export type StreetBuilding=StreetFootprint&{id:string;height:number;door:StreetDoor};
export type MarketStall=StreetFootprint&{id:string;kind:'textiles'|'pottery';shopId:string|null;state:'preview'};
export const STREET_BUILDINGS:StreetBuilding[]=[-1,1].flatMap(side=>[7,-7,-21].map((z,index)=>({
  id:`street-${side<0?'west':'east'}-${index+1}`,x:side*12,z,width:8,depth:10,height:8.2+(index%2)*1.4,
  door:{id:`door-${side<0?'west':'east'}-${index+1}`,x:side*8,z:z+1,approach:{x:side*6.8,z:z+1},interiorId:null,state:'closed' as const},
})));
export const MARKET_STALLS:MarketStall[]=[-1,1].flatMap(side=>[0,-14].map((z,index)=>({
  id:`stall-${side<0?'west':'east'}-${index+1}`,x:side*5.5,z,width:2.8,depth:2,
  kind:index===0?'textiles' as const:'pottery' as const,shopId:null,state:'preview' as const,
})));
export type StreetFeature={id:string;sourceId:string;kind:'door'|'stall';illustration:'door'|'textiles'|'pottery';title:string;description:string;x:number;z:number};
// Read-only inspection catalog. These IDs do not grant ownership or authorize
// service calls; a future adapter must independently verify any capability.
export const STREET_FEATURES:StreetFeature[]=[
  ...STREET_BUILDINGS.map((building,index)=>({id:building.door.id,sourceId:building.id,kind:'door' as const,illustration:'door' as const,
    title:`${building.x<0?'West':'East'} residence ${index%3+1}`,
    description:'A quiet home along the street. Its carved doorway is closed for now. Interiors and property features may be connected in a future version.',x:building.door.x,z:building.door.z})),
  ...MARKET_STALLS.map(stall=>({id:stall.id,sourceId:stall.id,kind:'stall' as const,illustration:stall.kind,
    title:`${stall.x<0?'West':'East'} ${stall.kind==='textiles'?'textile':'pottery'} stall`,
    description:stall.kind==='textiles'?'Folded cloth and woven colors beneath a striped canopy. This display is scenery, not an inventory for sale.':'Earthen vessels catch the afternoon light. This display is scenery, not an inventory for sale.',x:stall.x,z:stall.z})),
];
export const streetFeature=(id:string)=>STREET_FEATURES.find(feature=>feature.id===id);
const STREET_SOLIDS=[...STREET_BUILDINGS,...MARKET_STALLS];
export function streetBlocked(x:number,z:number){
  // A small body clearance keeps the robe out of walls and counters.
  return STREET_SOLIDS.some(b=>Math.abs(x-b.x)<b.width/2+.25&&Math.abs(z-b.z)<b.depth/2+.25);
}
