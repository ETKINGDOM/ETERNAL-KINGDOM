import * as T from 'three';
import { batchRigidParts } from './Pilgrim3D';

export function createSanctuaryDoor(scene:T.Scene,interior:boolean){
  const root=new T.Group();root.position.set(0,interior?0:2.61,interior?14:-26.4);
  if(interior)root.rotation.y=Math.PI;
  scene.add(root);
  const stone=new T.MeshStandardMaterial({color:0xe9dfc8,roughness:.72});
  const wood=new T.MeshStandardMaterial({color:0x314b56,roughness:.72});
  const recess=new T.MeshStandardMaterial({color:0x152d37,roughness:.86});
  const gold=new T.MeshStandardMaterial({color:0xc7aa70,metalness:.65,roughness:.32});
  const light=new T.MeshBasicMaterial({color:0xffe9bb,transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide});
  const add=(parent:T.Group,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{
    const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  for(const side of [-1,1]){
    add(root,new T.BoxGeometry(.7,7.9,1.1),stone,side*3.95,3.95,0);
    add(root,new T.BoxGeometry(.1,7.6,1.13),gold,side*3.57,3.8,.01);
    add(root,new T.BoxGeometry(1.1,.24,1.45),stone,side*3.95,.12,.04);
  }
  const curve=new T.EllipseCurve(0,7.8,3.95,3.95,0,Math.PI,false,0);
  const points=curve.getPoints(48).map(p=>new T.Vector3(p.x,p.y,0));
  add(root,new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.35,8,false),stone,0,0,0);
  add(root,new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.055,6,false),gold,0,0,.37);
  add(root,new T.BoxGeometry(7.2,.16,2.4),stone,0,.02,-.6);
  // A real, empty passage behind two swinging leaves; no solid doorway panel.
  add(root,new T.PlaneGeometry(7.1,9.7),light,0,4.9,-2.5);
  const leaves:T.Group[]=[];
  for(const side of [-1,1]){
    const hinge=new T.Group();hinge.position.set(side*3.55,.12,0);root.add(hinge);leaves.push(hinge);
    const center=-side*1.765;
    add(hinge,new T.BoxGeometry(3.53,7.45,.22),wood,center,3.725,0);
    for(const edge of [-1,1])add(hinge,new T.BoxGeometry(.09,7.35,.3),gold,center+edge*1.66,3.72,.04);
    for(const y of [.13,2.7,5.3,7.3])add(hinge,new T.BoxGeometry(3.39,.08,.3),gold,center,y,.04);
    for(const y of [1.43,4,6.3]){
      add(hinge,new T.BoxGeometry(2.96,2,.08),recess,center,y,.14);
      const emblem=add(hinge,new T.TorusGeometry(.29,.025,6,32),gold,center,y,.21);
      emblem.rotation.z=Math.PI/4;
      add(hinge,new T.BoxGeometry(.045,.88,.06),gold,center,y,.24);
    }
    const handle=add(hinge,new T.TorusGeometry(.13,.035,8,24),gold,-side*3.13,3.1,.3);
    handle.scale.y=1.35;
  }
  let openness=0;
  for(const group of [root,...leaves])batchRigidParts(group);
  const anchor=new T.Vector3(0,interior?8.6:11.2,interior?14:-26.4);
  return {root,anchor,
    update(position:{x:number;z:number},dt:number,reduced:boolean){
      const nearby=Math.hypot(position.x,position.z-root.position.z)<10;
      openness=T.MathUtils.lerp(openness,nearby?1:0,reduced?1:1-Math.exp(-dt*3.5));
      leaves[0].rotation.y=openness*1.44;leaves[1].rotation.y=-openness*1.44;
      return openness;
    },
    hit(ray:T.Ray){
      // The follow camera can sit beyond the entrance while the player faces
      // inward. Never let the back of that doorway intercept floor clicks.
      if(ray.direction.z*(interior?-1:1)>=0)return false;
      const hit=ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-root.position.z),new T.Vector3());
      return !!hit&&Math.abs(hit.x)<4.4&&hit.y>root.position.y&&hit.y<root.position.y+11.5;
    },
  };
}
