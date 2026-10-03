import { canTravel, walkable, WORLD, type Point, type Scene } from '../shared/world';

// Bounded, click-time path search only; never per frame. The server still
// validates every movement segment. Simplification cannot cut through water.
export function walkingRoute(scene:Scene,from:Point,to:Point):Point[]{
  if(!walkable(scene,to))return [];
  if(canTravel(scene,from,to))return [to];
  const step=20,cols=WORLD.width/step+1,rows=Math.floor(WORLD.height/step)+1;
  const points:Point[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)points.push({x:x*step,y:y*step});
  const distance=(a:Point,b:Point)=>Math.hypot((a.x-b.x)*.04,(a.y-b.y)*.07);
  const allowed=points.map(p=>walkable(scene,p));
  const costs=new Map<number,number>(),parent=new Map<number,number>(),open=new Set<number>();
  points.forEach((p,id)=>{if(allowed[id]&&Math.abs(p.x-from.x)<=step*2&&Math.abs(p.y-from.y)<=step*2&&canTravel(scene,from,p)){open.add(id);costs.set(id,distance(from,p));parent.set(id,-1);}});
  while(open.size){
    let id=-1,best=Infinity;
    for(const candidate of open){const score=costs.get(candidate)!+distance(points[candidate],to);if(score<best){best=score;id=candidate;}}
    open.delete(id);const p=points[id];
    if(distance(p,to)<3&&canTravel(scene,p,to)){
      const raw:Point[]=[to];for(let cursor=id;cursor!==-1;cursor=parent.get(cursor)!)raw.unshift(points[cursor]);
      const path:Point[]=[];let anchor=from;
      for(let i=0;i<raw.length;){let next=i;while(next+1<raw.length&&canTravel(scene,anchor,raw[next+1]))next++;path.push(raw[next]);anchor=raw[next];i=next+1;}
      return path;
    }
    const x=id%cols,y=Math.floor(id/cols);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
      const nx=x+dx,ny=y+dy,n=ny*cols+nx;
      if(nx<0||ny<0||nx>=cols||ny>=rows||!allowed[n]||!canTravel(scene,p,points[n]))continue;
      const cost=costs.get(id)!+distance(p,points[n]);
      if(cost>=(costs.get(n)??Infinity))continue;costs.set(n,cost);parent.set(n,id);open.add(n);
    }
  }
  return [];
}
