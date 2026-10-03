import { WORLD } from '../shared/world';
export function worldCamera(width:number,height:number,focusX=600) {
  const scale=Math.max(width/WORLD.width,height/WORLD.height);
  const visibleWidth=width/scale;const visibleHeight=height/scale;
  return {scale,x:Math.max(0,Math.min(WORLD.width-visibleWidth,focusX-visibleWidth/2)),y:(WORLD.height-visibleHeight)/2};
}
