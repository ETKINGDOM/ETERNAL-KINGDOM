import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { Scene } from '../../shared/world';
import { createSanctuaryDoor } from './SanctuaryDoor';
import { createSanctuaryLight } from './SanctuaryLight';
import { isScenic } from '../../shared/scenes';
import { buildScenicArchitecture } from './ScenicArchitecture';
import {DESKTOP_REFLECTION_SIZE} from '../renderEnergy';

function marbleTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d')!;c.fillStyle='#e4e0d5';c.fillRect(0,0,1024,1024);
  let seed=27;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<180;i++){
    c.beginPath();let x=random()*1300-150,y=random()*1024;c.moveTo(x,y);
    for(let k=0;k<12;k++){x+=random()*85-20;y+=random()*85-20;c.lineTo(x,y);}
    c.strokeStyle=`rgba(100,119,123,${random()*.055})`;c.lineWidth=random()*3+.3;c.stroke();
  }
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(4,7);texture.colorSpace=T.SRGBColorSpace;
  return texture;
}

// Merge static architectural parts by material: detail without hundreds of draw calls.
function bake(group:T.Group) {
  group.updateMatrixWorld(true);
  const batches=new Map<T.Material,T.BufferGeometry[]>();const originals=new Set<T.BufferGeometry>();
  group.traverse(obj=>{if(obj instanceof T.Mesh&&!Array.isArray(obj.material)){
    const geometry=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
    const list=batches.get(obj.material)??[];list.push(geometry);batches.set(obj.material,list);originals.add(obj.geometry);
  }});
  group.clear();
  for(const [material,geometries] of batches){
    const flat=geometries.map(g=>g.index?g.toNonIndexed():g);
    const merged=mergeGeometries(flat);
    if(merged){const mesh=new T.Mesh(merged,material);mesh.castShadow=!(material instanceof T.MeshStandardMaterial&&material.metalness>.4);mesh.receiveShadow=true;group.add(mesh);}
    flat.forEach(g=>g.dispose());
    for(const g of geometries)g.dispose();
  }
  for(const geometry of originals)geometry.dispose();
}

export function buildArchitecture(scene:T.Scene,kind:Scene,small:boolean) {
  if(isScenic(kind))return buildScenicArchitecture(scene,kind,small);
  const stone=new T.MeshStandardMaterial({color:0xe9e3d3,roughness:.76,metalness:.02});
  const lightStone=new T.MeshStandardMaterial({color:0xf6ecd7,roughness:.55});
  const gold=new T.MeshStandardMaterial({color:0xbba36b,roughness:.43,metalness:.58});
  const dark=new T.MeshStandardMaterial({color:0x233d4a,roughness:.7});
  const blue=new T.MeshStandardMaterial({color:0x527487,roughness:.94,side:T.DoubleSide});
  const leaves=new T.MeshStandardMaterial({color:0x405e55,roughness:1});
  const light=new T.MeshBasicMaterial({color:new T.Color(2.3,1.83,1.12),toneMapped:false});
  const architecture=new T.Group();scene.add(architecture);
  const stoneTexture=marbleTexture();stoneTexture.repeat.set(.25,.8);stone.map=stoneTexture;lightStone.map=stoneTexture;
  const mesh=(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0)=>{const a=new T.Mesh(g,m);a.position.set(x,y,z);architecture.add(a);return a;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material=stone)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z);
  const cylinder=(rt:number,rb:number,h:number,x:number,y:number,z:number,m:T.Material=stone,n=24)=>mesh(new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);
  const ring=(r:number,t:number,x:number,y:number,z:number,m:T.Material=gold)=>{const a=mesh(new T.TorusGeometry(r,t,6,72),m,x,y,z);return a;};
  function column(x:number,z:number,height=11){
    box(2.1,.3,2.1,x,.15,z);box(1.75,.23,1.75,x,.41,z,lightStone);
    cylinder(.77,.88,.35,x,.7,z);cylinder(.48,.64,height-1.65,x,(height-1.65)/2+.87,z,lightStone,32);
    for(const [y,r] of [[.92,.67],[1.08,.65],[height-.68,.57],[height-.51,.73],[height-.24,.9]])cylinder(r,r,.13,x,y,z,gold);
    box(1.9,.24,1.9,x,height,z);
    // Four slender engaged shafts catch light and give the column a carved profile.
    for(let k=0;k<4;k++){const a=k*Math.PI/2;cylinder(.095,.13,height-2.4,x+Math.cos(a)*.58,(height-2.4)/2+1.1,z+Math.sin(a)*.58);}
  }
  function arch(x:number,z:number,width:number,spring:number,m:T.Material=stone,depth=.38){
    const radius=width/2;const pts=[];
    for(let i=0;i<=48;i++){const a=i/48*Math.PI;pts.push(new T.Vector3(x+Math.cos(a)*radius,spring+Math.sin(a)*radius,z));}
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),64,depth,8,false),m);
  }
  function star(x:number,y:number,z:number,size:number){
    const shape=new T.Shape();
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const r=i%2?size*.16:size;const px=Math.sin(a)*r,py=Math.cos(a)*r;i?shape.lineTo(px,py):shape.moveTo(px,py);}shape.closePath();
    mesh(new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false}),light,x,y,z);
  }
  function glow(x:number,y:number,z:number,width:number,height:number){
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);float a=pow(max(0.,1.-d),3.)*.6;gl_FragColor=vec4(1.,.73,.3,a);}' });
    const halo=new T.Mesh(new T.PlaneGeometry(width,height),material);halo.position.set(x,y,z);scene.add(halo);
  }
  function lamp(x:number,z:number){
    cylinder(.3,.45,.23,x,.115,z,gold);cylinder(.06,.12,1.2,x,.8,z,gold);
    cylinder(.23,.15,.22,x,1.48,z,gold);cylinder(.12,.12,.38,x,1.72,z,lightStone);
    const flame=mesh(new T.SphereGeometry(.09,8,8),light,x,1.98,z);flame.scale.y=2;
  }
  function tree(x:number,z:number,height=6){
    cylinder(.6,.8,.7,x,.35,z,lightStone);cylinder(.12,.17,height*.55,x,height*.27+.7,z,dark);
    for(let i=0;i<4;i++)cylinder(.03,.65-i*.09,height*.68,x,1.8+i*.65,z,leaves,12);
  }
  function terraceRail(x:number,z:number,w:number,turn=false){
    const a=box(w,.14,.3,x,.95,z,lightStone);if(turn)a.rotation.y=Math.PI/2;
    const b=box(w,.12,.35,x,.14,z);if(turn)b.rotation.y=Math.PI/2;
    for(let i=-w/2;i<=w/2;i+=1.3){const px=turn?x:x+i,pz=turn?z+i:z;cylinder(.07,.12,.73,px,.53,pz);}
  }

  const marble=marbleTexture();
  const floorMaterial=new T.MeshStandardMaterial({map:marble,color:0xf1ede2,roughness:.4,metalness:.06,transparent:!small,opacity:small?1:.95});
  const floor=new T.Mesh(new T.PlaneGeometry(52,92),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.set(0,.012,-13);floor.receiveShadow=true;scene.add(floor);
  let reflection:Reflector|null=null;
  if(!small){reflection=new Reflector(new T.PlaneGeometry(52,92),{textureWidth:DESKTOP_REFLECTION_SIZE,textureHeight:DESKTOP_REFLECTION_SIZE,multisample:0,color:0x9eabb6,clipBias:.004});reflection.rotation.x=-Math.PI/2;reflection.position.set(0,-.008,-13);scene.add(reflection);}
  // Inlaid floor joints and a central processional path, all actual world geometry.
  for(let x=-24;x<=24;x+=4)box(.035,.005,68,x,.024,-8,gold);
  for(let z=-40;z<=24;z+=4)box(48,.005,.035,0,.024,z,gold);
  for(const x of [-5.6,-5.4,5.4,5.6])box(.032,.007,59,x,.026,-8,gold);
  for(const r of [2.8,3,4.3]){const a=ring(r,.024,0,.035,1.5);a.rotation.x=-Math.PI/2;}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const bar=box(.028,.008,7,0,.04,1.5,gold);bar.rotation.y=a;}

  if(kind==='temple'){
    // A 28-metre vault above a wide, clear nave. Columns stay outside movement bounds.
    for(const z of [-28,-19,-10,-1,8,17]){
      column(-17.4,z);column(17.4,z);
      // Leave the skylight bay unobstructed by a transverse ceiling rib.
      if(z!==-10){arch(0,z,34.8,11,stone,.48);arch(0,z-.22,33.8,11,gold,.045);}
      for(const x of [-17.4,17.4]){box(1.5,.8,9,x,11.55,z+4.5);box(1.7,.08,9,x,12.01,z+4.5,gold);}
    }
    // Vault panels: softly lit ivory, restrained rather than densely ornamented.
    const vaultMaterial=new T.MeshStandardMaterial({color:0x9aafb8,roughness:1,side:T.DoubleSide});
    const cut=Math.asin(5/17.4);
    const vaultPart=(start:number,angle:number,length:number,z:number)=>{
      const part=mesh(new T.CylinderGeometry(17.4,17.4,length,48,1,true,start,angle),vaultMaterial,0,11,z);part.rotation.x=Math.PI/2;
    };
    // Four vault sections leave a real opening above the central prayer floor.
    vaultPart(Math.PI/2,Math.PI/2-cut,52,-5.5);vaultPart(Math.PI+cut,Math.PI/2-cut,52,-5.5);
    vaultPart(Math.PI-cut,cut*2,19.5,-21.75);vaultPart(Math.PI-cut,cut*2,22.5,9.25);
    const surround=new T.Shape();surround.moveTo(-5,-5);surround.lineTo(5,-5);surround.lineTo(5,5);surround.lineTo(-5,5);surround.closePath();
    const opening=new T.Path();opening.absarc(0,0,4.15,0,Math.PI*2,true);surround.holes.push(opening);
    const oculus=mesh(new T.ShapeGeometry(surround,64),new T.MeshStandardMaterial({color:0xebe2cf,roughness:.8,side:T.DoubleSide}),0,27.4,-7);oculus.rotation.x=-Math.PI/2;
    for(const [r,t,y,material] of [[4.22,.19,27.37,lightStone],[4.48,.055,27.32,gold],[4.8,.08,27.4,lightStone]] as const){const rim=ring(r,t,0,y,-7,material);rim.rotation.x=-Math.PI/2;}
    for(const side of [-1,1]){
      for(const z of [-23.5,-14.5,-5.5,3.5,12.5]){
        // Side arches are perpendicular to the nave, framing open sky.
        const pts=[];for(let i=0;i<=32;i++){const t=i/32*Math.PI;pts.push(new T.Vector3(side*17.5,6+Math.sin(t)*4.1,z+Math.cos(t)*4.1));}
        mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,.22,6,false),lightStone);
        terraceRail(side*18,z,7.9,true);
        const banner=mesh(new T.PlaneGeometry(1.5,5.1,4,10),blue,side*16.75,8.1,z-2.8);banner.rotation.y=side*Math.PI/2;
        const pos=banner.geometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getY(i)*1.8)*.09);pos.needsUpdate=true;banner.geometry.computeVertexNormals();
      }
      for(const z of [-11,1,13]){tree(side*18.8,z,5);lamp(side*8.8,z);}
    }
    // No throne, statue or sacrificial pedestal: an empty, level prayer floor.
    for(const r of [4.65,4.83]){const inlay=ring(r,.018,0,.04,-7,gold);inlay.rotation.x=-Math.PI/2;}
    // The far apse remains architectural, not an object of worship.
    const apseStone=new T.MeshStandardMaterial({color:0x657f89,roughness:.95,map:stoneTexture});
    box(36,29,.7,0,14.5,-38.2,apseStone);
    for(let i=-3;i<=3;i++){const a=i*.34;column(Math.sin(a)*11,-32-Math.cos(a)*4,12);}
    arch(0,-36,13,12,lightStone,.55);arch(0,-35.8,12,12,gold,.075);
    for(const x of [-7,7]){tree(x,-23,6);lamp(x,-19);}
  }else{
    // Courtyard basin matches the authoritative ellipse at protocol (600,444).
    const basin=cylinder(6.72,6.85,.44,0,.22,-9.17,lightStone,72);basin.scale.z=3.29/6.72;
    for(const r of [6.62,6.83]){const rim=ring(r,.11,0,.48,-9.17);rim.rotation.x=-Math.PI/2;rim.scale.y=3.29/6.72;}
    const water=new T.Mesh(new T.CircleGeometry(6.48,72),new T.MeshStandardMaterial({color:0x669698,roughness:.15,metalness:.42}));water.rotation.x=-Math.PI/2;water.scale.y=3.15/6.48;water.position.set(0,.46,-9.17);scene.add(water);
    for(let i=0;i<9;i++)box(27-i*.65,.29,9-i*.6,0,.14+i*.29,-20.5-i*.3,lightStone);
    for(const x of [-14,-9,9,14])column(x,-27,20);
    for(const x of [-11.5,11.5]){
      box(5,18,3,x,11.5,-29);
      box(2.4,10,.2,x,10,-27.4,blue);
      for(const offset of [-1.25,1.25])box(.07,10,.12,x+offset,10,-27.2,gold);
      box(2.6,.07,.12,x,15,-27.2,gold);
      arch(x,-27.15,2.5,15,gold,.08);
    }
    arch(0,-27,18,12,lightStone,.9);arch(0,-26.6,16.6,12,gold,.13);
    box(30,1.2,4,0,22,-29);box(32,.23,4.3,0,22.8,-29,gold);
    const dome=mesh(new T.SphereGeometry(11,48,24,0,Math.PI*2,0,Math.PI/2),lightStone,0,23,-31);dome.scale.y=.84;
    for(const y of [23,23.5])cylinder(11.2,11.2,.17,0,y,-31,gold,64);
    cylinder(.1,1,4,0,34,-31,gold);star(0,36,-31,1.1);
    // Dark inner doorway provides depth around the warm, luminous emblem.
    box(3.25,17,.3,-5.4,10.5,-33,dark);box(3.25,17,.3,5.4,10.5,-33,dark);box(7.6,5,.3,0,17,-33,dark);glow(0,13,-26.2,17,21);
    ring(2.6,.09,0,13,-26);star(0,13,-25.8,1.8);
    for(const side of [-1,1]){
      for(const z of [-24,-12,0,12]){column(side*23,z,8);tree(side*22,z+4,6);}
      terraceRail(side*23,3,27,true);
      for(const z of [-13,0,12])lamp(side*16,z);
      for(const z of [-35,-55]){box(14,13,14,side*31,6.5,z);mesh(new T.SphereGeometry(8,24,12,0,Math.PI*2,0,Math.PI/2),lightStone,side*31,13,z);for(const x of [-5,0,5]){column(side*31+x,z+7,13);box(2.3,7,.15,side*31+x,7,z+7.1,blue);}}
    }
  }
  // Distant architecture through the colonnade gives a visible world beyond the nave.
  for(let i=0;i<22;i++){
    const a=i/22*Math.PI*2,x=Math.cos(a)*75,z=Math.sin(a)*75-30,h=8+(i*13%21);
    box(3.5,h,3.5,x,h/2-3,z,lightStone);cylinder(0,3,h*.4,x,h+h*.2-3,z,lightStone,8);
  }
  bake(architecture);

  // Gentle translucent shafts, not a claim of physical volumetric path tracing.
  const beams=new T.Group();scene.add(beams);
  for(let i=0;i<4;i++){
    const g=new T.BufferGeometry();const z=-25+i*10;
    g.setAttribute('position',new T.Float32BufferAttribute([14,19,z,16,19,z+1,-7,.12,z+13,-11,.12,z+11],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
    g.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;void main(){float edge=pow(sin(vUv.x*3.14159),2.);float a=edge*(.018+.022*vUv.y)*smoothstep(0.,.15,vUv.y);gl_FragColor=vec4(1.,.88,.62,a);}' });
    beams.add(new T.Mesh(g,material));
  }
  const dustGeometry=new T.BufferGeometry();const positions=new Float32Array(150*3);
  for(let i=0;i<150;i++){positions[i*3]=Math.sin(i*51.7)*16;positions[i*3+1]=(i*13.13)%16+1;positions[i*3+2]=(i*9.7)%65-35;}
  dustGeometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0xffe4aa,size:.035,transparent:true,opacity:.48,depthWrite:false}));scene.add(dust);
  const door=createSanctuaryDoor(scene,kind==='temple');
  const lightColumn=kind==='temple'?createSanctuaryLight(scene,small):null;
  return {reflection,dust,marble,door,lightColumn};
}

export function addSky(scene:T.Scene){
  const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vP;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec3 d=normalize(vP);float h=max(d.y,0.);vec3 col=mix(vec3(.32,.52,.64),vec3(.08,.22,.38),pow(h,.6));vec2 p=d.xz/max(.12,d.y+.22)*3.;float n=noise(p)*.6+noise(p*2.1)*.28+noise(p*4.3)*.12;float cloud=smoothstep(.42,.74,n)*(1.-smoothstep(.2,.7,h));col=mix(col,vec3(1.,.96,.87),cloud*.85);float sun=pow(max(dot(d,normalize(vec3(-.2,.36,-1.))),0.),170.);col+=vec3(1.,.78,.4)*sun*.7;gl_FragColor=vec4(col,1.);}`});
  const sky=new T.Mesh(new T.SphereGeometry(240,32,16),material);scene.add(sky);
}
