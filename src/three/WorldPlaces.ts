import * as T from 'three';
import { SANCTUARY_PLACES } from '../../shared/places';
import { RIVER_CHANNEL, VISIT_AREAS, type Scene } from '../../shared/world';
import { toWorld } from './coordinates';
import { batchRigidParts } from './Pilgrim3D';

export function createWorldPlaces(scene:T.Scene,kind:Scene,compact:boolean){
  const root=new T.Group();scene.add(root);
  if(kind!=='temple'&&kind!=='plaza')return {root,stations:[] as T.Group[]};
  const stone=new T.MeshStandardMaterial({color:0xe1dccb,roughness:.88});
  const gold=new T.MeshStandardMaterial({color:0xb99a5b,roughness:.55,metalness:.35});
  const wood=new T.MeshStandardMaterial({color:0x5e5445,roughness:1});
  const green=new T.MeshStandardMaterial({color:0x688c75,roughness:1});
  const grass=new T.MeshStandardMaterial({color:0x809784,roughness:1});
  const water=new T.MeshStandardMaterial({color:0x579caa,roughness:.24,metalness:.25});
  const light=new T.MeshBasicMaterial({color:0xffe5a0});
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,parent=root)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m=stone,parent=root)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  const disc=(r:number,x:number,y:number,z:number,m:T.Material=stone,parent=root)=>{const obj=add(new T.CircleGeometry(r,compact?24:40),m,x,y,z,parent);obj.rotation.x=-Math.PI/2;return obj;};
  const trunk=(x:number,z:number)=>{
    add(new T.CylinderGeometry(.12,.2,2.4,8),wood,x,1.2,z);
    for(let i=0;i<3;i++){const canopy=add(new T.IcosahedronGeometry(1.35,compact?0:1),green,x+Math.sin(i*2)*.65,2.6+i*.45,z+Math.cos(i*2)*.4);canopy.scale.y=.8;}
    disc(1.55,x,.042,z,grass);
  };
  const stations:T.Group[]=[];
  if(kind==='temple'){
    for(const p of SANCTUARY_PLACES){
      const {x,z}=toWorld(p),group=new T.Group();group.userData.sanctuaryAction=p.id;root.add(group);stations.push(group);
      disc(.78,x,.052,z,gold,group);box(.85,.22,.7,x,.11,z,stone,group);
      if(p.id==='prayer'){
        add(new T.CylinderGeometry(.07,.13,1.3,12),gold,x,.85,z,group);
        add(new T.CylinderGeometry(.35,.12,.25,16),gold,x,1.57,z,group);
        const flame=add(new T.SphereGeometry(.17,12,8),light,x,1.86,z,group);flame.scale.y=1.6;
      }else if(p.id==='confession'){
        for(const side of [-1,0,1]){const panel=box(.48,1.85,.13,x+side*.49,1.02,z,wood,group);panel.rotation.y=side*-.25;box(.035,1.8,.2,x+side*.49,1.02,z-.08,gold,group);}
        box(1.05,.3,.42,x,.27,z+.35,stone,group);
      }else if(p.id==='praise'){
        box(.22,1.03,.22,x,.64,z,wood,group);
        const desk=box(1.05,.1,.72,x,1.24,z,gold,group);desk.rotation.x=.28;
        for(const side of [-1,1]){const page=box(.43,.04,.57,x+side*.22,1.32,z,stone,group);page.rotation.z=side*.12;page.rotation.x=.28;}
      }else{
        box(1.05,.8,.65,x,.63,z,wood,group);box(1.1,.12,.7,x,1.1,z,gold,group);
        box(.36,.025,.07,x,1.17,z,wood,group);
      }
      batchRigidParts(group);
    }
  }else if(kind==='plaza'){
    // Three continuous districts; no new room/socket or full-scene render pass.
    const garden=VISIT_AREAS[0];
    const gardenCenter=toWorld({x:995,y:400});
    box(11.6,.026,26.6,gardenCenter.x,.028,gardenCenter.z,grass);
    box(2,.035,27,15.6,.05,-8,stone);
    for(const p of [{x:910,y:290},{x:1080,y:290},{x:1110,y:460},{x:900,y:510}]){const w=toWorld(p);trunk(w.x,w.z);}
    const seat=toWorld({x:garden.x+80,y:garden.y+65});box(1.8,.34,.48,seat.x,.2,seat.z);box(1.8,.66,.16,seat.x,.7,seat.z-.23);
    const river=RIVER_CHANNEL,a=toWorld({x:river.left,y:river.top}),b=toWorld({x:river.right,y:river.bottom});
    box(b.x-a.x,.022,b.z-a.z,(a.x+b.x)/2,.051,(a.z+b.z)/2,water);
    for(const x of [a.x-.12,b.x+.12])box(.18,.16,b.z-a.z,x,.08,(a.z+b.z)/2,stone);
    const bridge=toWorld({x:(river.left+river.right)/2,y:410});
    box(b.x-a.x+.6,.08,2.8,bridge.x,.06,bridge.z,wood);
    for(const z of [bridge.z-1.3,bridge.z+1.3]){box(b.x-a.x+.7,.07,.08,bridge.x,.9,z,gold);for(const x of [a.x-.18,b.x+.18])box(.1,.9,.1,x,.45,z,gold);}
    for(const p of [{x:95,y:285},{x:310,y:295},{x:90,y:560},{x:290,y:540}]){const w=toWorld(p);trunk(w.x,w.z);}
    const terrace=toWorld({x:600,y:815});
    box(32,.024,8,terrace.x,.045,terrace.z,stone);
    for(const side of [-1,1]){
      box(4,.32,.6,side*9,.2,terrace.z,stone);box(4,.7,.16,side*9,.68,terrace.z+.3,stone);
      add(new T.CylinderGeometry(.3,.4,4.6,12),stone,side*15,2.3,terrace.z+1.8);
    }
    box(32,.15,.22,0,1.15,19.4,stone);
    for(let x=-16;x<=16;x+=1.5)box(.075,1.08,.075,x,.56,19.4,gold);
    // A distant floating skyline beyond the railing, deliberately inaccessible.
    for(let i=0;i<9;i++)box(2.5,7+i%3*3,2.5,(i-4)*7,-3,48+(i%2)*7,stone);
  }
  batchRigidParts(root);
  return {root,stations};
}
