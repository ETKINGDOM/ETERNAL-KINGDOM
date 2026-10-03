// Continuous lower robe: the hem drapes over the folded legs, while its upper
// rings share the torso's hip pivot. Rigid Y scaling left a hole during bows.
export function robeVertex(x:number,y:number,z:number,k:number,lean:number,breath:number){
  const t=Math.max(0,Math.min(1,(y-.5)/.7));
  const weight=t*t*(3-2*t);
  const hipY=1.2-.64*k+breath,hipZ=.08*k;
  const topY=hipY+(y-1.2)*Math.cos(lean)-z*Math.sin(lean);
  const topZ=hipZ+(y-1.2)*Math.sin(lean)+z*Math.cos(lean);
  return {
    x:x*(1+.17*k*(1-weight)),
    y:y*(1-.54*k)*(1-weight)+topY*weight,
    z:(z*(1+.55*k)+.1*k)*(1-weight)+topZ*weight,
  };
}
