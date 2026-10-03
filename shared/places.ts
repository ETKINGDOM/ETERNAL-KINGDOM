export type SanctuaryAction='prayer'|'confession'|'praise'|'donation';
export const SANCTUARY_FOCUS={x:600,y:475} as const;
// Four quarters outside the daylight pool; keep the central aisle unobstructed.
export const SANCTUARY_PLACES:{id:SanctuaryAction;name:string;object:string;x:number;y:number}[]=[
  {id:'prayer',name:'Prayer',object:'Prayer lamp',x:SANCTUARY_FOCUS.x-160,y:SANCTUARY_FOCUS.y-80},
  {id:'confession',name:'Confession',object:'Quiet screen',x:SANCTUARY_FOCUS.x+160,y:SANCTUARY_FOCUS.y-80},
  {id:'praise',name:'Praise',object:'Book of gratitude',x:SANCTUARY_FOCUS.x-160,y:SANCTUARY_FOCUS.y+80},
  {id:'donation',name:'Donation',object:'Giving chest',x:SANCTUARY_FOCUS.x+160,y:SANCTUARY_FOCUS.y+80},
];
