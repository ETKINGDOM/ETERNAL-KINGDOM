import * as T from 'three';
import { MARKET_STALLS, STREET_BUILDINGS } from '../../shared/market';
import { batchRigidParts } from './Pilgrim3D';

// Closed facades and preview stalls only. The shared catalog holds extension
// points, independent of this replaceable static-mesh renderer.
export function buildMarketStreet(scene:T.Scene,compact:boolean){
  const root=new T.Group();root.name='market-street';scene.add(root);
  const material=(color:number,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
  const ivory=material(0xece3cd),sand=material(0xc8b898),cream=material(0xf5ecd8);
  const blue=material(0x31526b),pale=material(0x8195a2),wood=material(0x665343),dark=material(0x34434c);
  const gold=new T.MeshStandardMaterial({color:0xbba16a,metalness:.35,roughness:.5});
  const clay=material(0xbc8e6a),leaf=material(0x728777),paving=material(0xd2cbb9);
  const lamp=new T.MeshStandardMaterial({color:0xf6dba2,emissive:0xe8b86d,emissiveIntensity:.5,roughness:.5});
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material=ivory)=>add(new T.BoxGeometry(w,h,d),m,x,y,z);
  const arch=(radius:number,base:number,m:T.Material,x:number,z:number,turn=0,tube=.12)=>{
    const curve=new T.CatmullRomCurve3(Array.from({length:17},(_,i)=>{const a=i/16*Math.PI;return new T.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,0);}));
    const mesh=add(new T.TubeGeometry(curve,compact?16:24,tube,6,false),m,x,base,z);mesh.rotation.y=turn;
  };
  const archedPanel=(w:number,h:number,m:T.Material,x:number,y:number,z:number,turn:number)=>{
    const r=w/2,shape=new T.Shape();shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,h-r);shape.absarc(0,h-r,r,0,Math.PI,false);shape.lineTo(-r,0);
    const mesh=add(new T.ShapeGeometry(shape,compact?10:20),m,x,y,z);mesh.rotation.y=turn;
  };
  box(39,.4,45,0,-.2,-6,paving);box(39,2.4,45,0,-1.6,-6,sand);
  // Flush paving keeps keyboard movement, collision and visible ground aligned.
  box(7.6,.025,44,0,.018,-6,cream);
  for(const x of [-3.8,3.8])box(.07,.01,44,x,.04,-6,gold);
  for(let z=-27;z<=15;z+=1.8)box(7.6,.008,.028,0,.038,z,sand);
  for(let x=-3.6;x<=3.6;x+=1.2)box(.018,.008,43,x,.038,-6,sand);
  for(const building of STREET_BUILDINGS){
    const {x,z,height:h,width:w,depth:d,door}=building,side=Math.sign(x),front=side*7.94,turn=-side*Math.PI/2;
    box(w,h,d,x,h/2,z,ivory);
    for(const y of [.25,4.1,h-.2,h+.15])box(w+.25,.22,d+.25,x,y,z,y===4.1?sand:cream);
    // A roof parapet and occasional cupola create a varied, readable skyline.
    for(const dx of [-w/2,w/2])box(.22,.65,d,x+dx,h+.48,z,cream);
    for(const dz of [-d/2,d/2])box(w,.65,.22,x,h+.48,z+dz,cream);
    if(z===-21){add(new T.CylinderGeometry(2.35,2.35,.65,20),sand,x,h+.4,z);add(new T.SphereGeometry(2.5,compact?16:28,12,0,Math.PI*2,0,Math.PI/2),cream,x,h+.7,z);}
    // Doors face the street; handles, split leaves and archivolts remain visible.
    archedPanel(1.95,3.25,wood,front,0,door.z,turn);
    arch(1.1,2.25,cream,front-side*.04,door.z,turn,.18);
    for(const dz of [-1.1,1.1])box(.25,2.3,.22,front-side*.06,1.15,door.z+dz,cream);
    box(.055,2.25,.04,front-side*.035,1.125,door.z,gold);
    for(const dz of [-.25,.25]){const handle=add(new T.TorusGeometry(.085,.025,6,12),gold,front-side*.075,1.25,door.z+dz);handle.rotation.y=turn;}
    for(const dz of [-.78,-.52,.52,.78])box(.035,2.1,.025,front-side*.03,1.1,door.z+dz,sand);
    for(const y of [.48,1.8])box(.04,.045,1.8,front-side*.035,y,door.z,gold);
    // Wall-mounted lanterns use emissive surfaces, not extra dynamic lights.
    for(const dz of [-1.75,1.75]){
      const lx=front-side*.35,lz=door.z+dz;
      box(.6,.07,.07,front-side*.2,2.8,lz,gold);
      box(.3,.5,.3,lx,2.45,lz,lamp);
      for(const y of [2.18,2.72])box(.42,.075,.42,lx,y,lz,gold);
      for(const dx of [-.16,.16])for(const oz of [-.16,.16])box(.035,.55,.035,lx+dx,2.45,lz+oz,gold);
    }
    for(const floor of [0,1])for(const dz of [-3.35,3.35]){
      const base=floor?5.1:1.05;
      archedPanel(1.35,2.05,dark,front-side*.02,base,z+dz,turn);
      arch(.76,base+1.38,sand,front-side*.055,z+dz,turn,.1);
      box(.1,1.95,.06,front-side*.075,base+.94,z+dz,gold);
      box(.12,.09,1.35,front-side*.09,base+.7,z+dz,gold);
      box(.4,.16,1.7,front-side*.1,base-.08,z+dz,cream);
    }
    // A shallow blue canopy shades each entrance without blocking the walkway.
    const canopy=box(1.4,.08,2.8,front-side*.6,3.5,door.z,blue);canopy.rotation.z=side*.12;
    box(.08,.24,2.8,front-side*1.3,3.3,door.z,blue);
    // Small upper balcony, safely above pedestrian height.
    box(1.05,.2,3,front-side*.45,4.65,door.z,cream);
    box(.065,.06,3,front-side*.95,5.45,door.z,gold);
    for(let dz=-1.4;dz<=1.4;dz+=.4)box(.05,.78,.045,front-side*.95,5.05,door.z+dz,gold);
    for(const dz of [-4.75,4.75])box(.22,h,.25,front-side*.02,h/2,z+dz,cream);
    // Banners and relief medallions give the upper facades a civic character.
    box(.08,1.65,.75,front-side*.15,6.3,door.z,blue);
    for(const dz of [-.37,.37])box(.09,1.65,.035,front-side*.17,6.3,door.z+dz,gold);
    const seal=add(new T.TorusGeometry(.2,.035,6,16),gold,front-side*.22,6.3,door.z);seal.rotation.y=turn;
    for(const dz of [-3.35,3.35]){
      box(.38,.23,1.6,front-side*.12,4.91,z+dz,sand);
      for(let i=0;i<4;i++)add(new T.IcosahedronGeometry(.22,0),leaf,front-side*.25,5.13,z+dz-.55+i*.36);
    }
  }
  for(const stall of MARKET_STALLS){
    const {x,z,width:w,depth:d}=stall;
    box(w,.9,d,x,.45,z,wood);box(w+.12,.12,d+.12,x,.96,z,sand);
    for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2])box(.09,2.9,.09,x+dx,1.45,z+dz,gold);
    // Striped fabric roof with a pitched profile, not a heavy solid block.
    for(let i=0;i<8;i++)for(const side of [-1,1]){
      const awning=box(w/8+.008,.035,1.26,x-w/2+(i+.5)*w/8,2.9,z+side*.58,i%2?cream:blue);awning.rotation.x=side*.25;
    }
    for(const side of [-1,1])box(w,.23,.04,x,2.6,z+side*1.2,blue);
    // Timber slats and brass corners add close-range detail to the counters.
    for(let dx=-w/2+.15;dx<w/2;dx+=.3)for(const side of [-1,1])box(.025,.76,.035,x+dx,.46,z+side*(d/2+.02),sand);
    for(const dx of [-w/2,w/2])box(.08,.85,d+.04,x+dx,.45,z,gold);
    for(let i=0;i<5;i++){
      const px=x+(i-2)*.43;
      if(stall.kind==='pottery'){
        const points=[new T.Vector2(.14,0),new T.Vector2(.22,.15),new T.Vector2(.23,.32),new T.Vector2(.12,.46),new T.Vector2(.13,.52)];
        add(new T.LatheGeometry(points,compact?8:16),i%2?clay:cream,px,1.03,z);
      }else{
        for(let layer=0;layer<3;layer++)box(.38,.09,.72,px,1.08+layer*.1,z,[pale,cream,blue][(i+layer)%3]);
      }
    }
  }
  // Distant civic arch frames the street, outside its playable boundary.
  for(const x of [-4,4]){box(1.3,9,1.5,x,4.5,-30,cream);box(1.7,.35,1.8,x,8.9,-30,sand);}
  arch(4,7.9,cream,0,-30,0,.5);
  box(1.1,5,12,-24,2,-17,sand);box(1.1,5,12,24,2,-17,sand);
  for(const side of [-1,1])for(const z of [13,-29]){
    const x=side*12;
    add(new T.CylinderGeometry(.62,.44,1,12),clay,x,.5,z);
    box(.16,2,.16,x,1.6,z,wood);
    const crown=add(new T.IcosahedronGeometry(1.25,compact?0:1),leaf,x,2.7,z);crown.scale.y=1.3;
  }
  batchRigidParts(root);
  const positions=new Float32Array(36*3);
  for(let i=0;i<36;i++){positions[i*3]=Math.sin(i*31)*3.5;positions[i*3+1]=1+(i%9)*.4;positions[i*3+2]=-25+(i*7.3)%38;}
  const dust=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)),new T.PointsMaterial({color:0xffedc8,size:.025,transparent:true,opacity:.3,depthWrite:false}));scene.add(dust);
  return {dust,reflection:null,door:null,lightColumn:null};
}
