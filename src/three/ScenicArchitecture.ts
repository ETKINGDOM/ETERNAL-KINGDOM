import * as T from 'three';
import type { Scene } from '../../shared/scenes';
import { batchRigidParts } from './Pilgrim3D';
import { buildMarketStreet } from './MarketStreet';

// Sightseeing-only maps. Static meshes are merged by material; no extra
// reflection targets, realtime lights, interaction services or textures.
export function buildScenicArchitecture(scene:T.Scene,kind:Scene,compact:boolean){
  if(kind==='market')return buildMarketStreet(scene,compact);
  const root=new T.Group();scene.add(root);
  const stone=new T.MeshStandardMaterial({color:0xe3decc,roughness:.85});
  const cream=new T.MeshStandardMaterial({color:0xf0e6ce,roughness:.72});
  const gold=new T.MeshStandardMaterial({color:0xb5a175,metalness:.35,roughness:.5});
  const green=new T.MeshStandardMaterial({color:kind==='cedar'?0x60836b:0x94a493,roughness:1});
  const foliage=new T.MeshStandardMaterial({color:0x416852,roughness:1});
  const bark=new T.MeshStandardMaterial({color:0x625647,roughness:1});
  const water=new T.MeshStandardMaterial({color:0x6cabb9,metalness:.35,roughness:.22});
  const rock=new T.MeshStandardMaterial({color:0x839497,roughness:1});
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material=stone)=>add(new T.BoxGeometry(w,h,d),m,x,y,z);
  const column=(x:number,z:number,h=8)=>{
    box(1.4,.25,1.4,x,.12,z,cream);
    add(new T.CylinderGeometry(.32,.44,h,compact?12:24),cream,x,h/2,z);
    for(const y of [.4,h-.35])add(new T.CylinderGeometry(.53,.53,.16,16),gold,x,y,z);
    box(1.35,.28,1.35,x,h,z,cream);
  };
  const arch=(x:number,z:number,width:number,height:number,turn=false)=>{
    const pts=Array.from({length:25},(_,i)=>{const a=i/24*Math.PI;return new T.Vector3(turn?x:x+Math.cos(a)*width/2,height+Math.sin(a)*width/2,turn?z+Math.cos(a)*width/2:z);});
    add(new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.25,6,false),cream,0,0,0);
  };
  const tree=(x:number,z:number,h:number)=>{
    add(new T.CylinderGeometry(.18,.32,h*.6,8),bark,x,h*.3,z);
    for(let i=0;i<4;i++){
      const crown=add(new T.ConeGeometry(2.1-i*.32,h*.45,compact?8:14),foliage,x,h*.45+i*.8,z);
      crown.rotation.y=i*.8;
    }
  };
  // Floor reaches just beyond authoritative bounds; cliffs remain outside it.
  box(39,.4,45,0,-.2,-6,kind==='cloister'?stone:green);
  box(39,2.4,45,0,-1.6,-6,rock);
  if(kind==='cedar'){
    box(6,.04,43,0,.025,-6,stone);
    box(37,.025,3.85,0,.04,-9.625,water);
    box(6.4,.08,4.5,0,.06,-9.625,cream);
    for(const x of [-3.1,3.1]){
      box(.08,.12,4.4,x,.9,-9.625,gold);
      for(const z of [-11.5,-7.75])box(.15,.9,.15,x,.45,z,cream);
    }
    for(const side of [-1,1]){
      for(let i=0;i<9;i++)tree(side*(8+(i%3)*4),-26+i*4.7,5.5+(i%3));
      box(3,.45,.7,side*6,.25,7,cream);
    }
    // A distant waterfall, outside the traversable bank, frames the bridge.
    box(.12,9,3.4,-25,3.4,-9.7,water);
    for(const z of [-13,-6]){const b=add(new T.IcosahedronGeometry(5,1),rock,-26,1,z);b.scale.set(1,1.7,1);}
  }else if(kind==='lake'){
    const lake=add(new T.CircleGeometry(1,compact?48:80),water,0,.035,-10.15);lake.rotation.x=-Math.PI/2;lake.scale.set(12.4,10.5,1);
    const rim=new T.Shape();rim.absellipse(0,0,14,12,0,Math.PI*2,false,0);
    const inner=new T.Path();inner.absellipse(0,0,12.5,10.6,0,Math.PI*2,true,0);rim.holes.push(inner);
    const promenade=add(new T.ShapeGeometry(rim,64),stone,0,.04,-10.15);promenade.rotation.x=-Math.PI/2;
    box(3.04,.07,25,0,.055,-10.15,cream);
    for(const x of [-1.5,1.5])for(let z=-21;z<=1;z+=2.7){box(.08,.65,.08,x,.35,z,gold);}
    for(const x of [-1.5,1.5])box(.065,.06,25,x,.68,-10.15,gold);
    // A small, open canopy at the far shore; nothing to activate or purchase.
    for(const x of [-3,3])for(const z of [-24,-28])column(x,z,5.5);
    const canopy=add(new T.SphereGeometry(4.2,compact?16:32,12,0,Math.PI*2,0,Math.PI/2),cream,0,5.6,-26);canopy.scale.y=.48;
    for(const side of [-1,1]){tree(side*17,7,6);tree(side*17,-24,7);box(3,.4,.75,side*10,.23,6,cream);}
    for(let i=0;i<7;i++){const hill=add(new T.IcosahedronGeometry(8,1),rock,(i-3)*13,-1,-50-(i%2)*8);hill.scale.y=1.2+(i%3)*.4;}
  }else{
    for(const x of [-18.8,18.8]){
      for(const z of [-26,-19,-12,-5,2,9])column(x,z,8);
      for(const z of [-22.5,-15.5,-8.5,-1.5,5.5])arch(x,z,7,8,true);
      box(2,.3,42,x,11.7,-8,cream);
    }
    for(const z of [-29,16.4]){
      for(const x of [-18,-12,-6,0,6,12,18])column(x,z,8);
      for(const x of [-15,-9,-3,3,9,15])arch(x,z,6,8);
    }
    for(let x=-16;x<=16;x+=4)box(.025,.01,42,x,.02,-6,gold);
    for(let z=-26;z<=14;z+=4)box(36,.01,.025,0,.02,z,gold);
    for(const r of [3.6,3.85,6]){const ring=add(new T.TorusGeometry(r,.035,6,64),gold,0,.06,-7);ring.rotation.x=-Math.PI/2;}
    for(const side of [-1,1]){
      tree(side*15,-6,5);box(3,.4,.7,side*12,.22,7,cream);
      // Remote domes are scenery, not additional enterable buildings.
      for(const z of [-45,-12,23]){box(9,12,9,side*39,3,z,cream);add(new T.SphereGeometry(5.5,24,12,0,Math.PI*2,0,Math.PI/2),cream,side*39,9,z);}
    }
  }
  batchRigidParts(root);
  const positions=new Float32Array(60*3);
  for(let i=0;i<60;i++){positions[i*3]=Math.sin(i*31)*17;positions[i*3+1]=1+(i%11)*.5;positions[i*3+2]=-25+(i*7.3)%40;}
  const dust=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)),new T.PointsMaterial({color:0xffedc8,size:.025,transparent:true,opacity:.4,depthWrite:false}));scene.add(dust);
  return {dust,reflection:null,door:null,lightColumn:null};
}
