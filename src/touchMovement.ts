export type MovementAxis={x:number;y:number;engaged:boolean};
export interface MovementInputPort {read():MovementAxis;set(x:number,y:number):void;clear():void}
const neutral:MovementAxis={x:0,y:0,engaged:false};
export function joystickAxis(dx:number,dy:number,radius=34){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {x:0,y:0};
  const distance=Math.hypot(dx,dy),amount=Math.min(1,distance/radius);
  if(amount<=.18)return {x:0,y:0};
  const scale=(amount-.18)/.82/distance;return {x:dx*scale,y:dy*scale};
}
/** Client input only: renderers consume the latest axis, never extra network packets. */
export function createMovementInput():MovementInputPort{
  let axis=neutral;
  return {read:()=>axis,set(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)){axis=neutral;return;}
    const length=Math.hypot(x,y),scale=length>1?1/length:1;axis={x:x*scale,y:y*scale,engaged:true};
  },clear(){axis=neutral;}};
}
