import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Player, Posture } from '../../shared/protocol';
import { robeVertex } from './robeDeformation';
import {applyPersonalRitualTint} from './PersonalRitualGlow';

export class Pilgrim3D {
  root=new T.Group();
  private robe:T.MeshStandardMaterial;
  private clothing:T.MeshStandardMaterial[];
  private body=new T.Group();
  private skirt=new T.Group();
  private cloth:T.LatheGeometry;
  private clothRest:Float32Array;
  private clothPose=[Infinity,Infinity,Infinity];
  private left=new T.Group();
  private right=new T.Group();
  private forearms:T.Group[]=[];
  private legs:T.Group[]=[];
  private label:T.Sprite;
  private labelAspect=1;
  private signature='';
  private displayingName=true;
  private posture:Posture='standing';
  private kneeling=0;
  private lean=0;
  private lastTime=0;
  private robeColor='';
  private readonly clothTint=new T.Color(0xeee8d9);
  constructor(player:Player,detail:'full'|'compact'='full'){
    const compact=detail==='compact';
    const segments=(full:number)=>compact?Math.max(6,Math.round(full*.45)):full;
    this.root.userData.personId=player.id;
    this.root.userData.detail=detail;
    this.root.add(this.body,this.skirt);
    this.robe=compact?new T.MeshStandardMaterial({color:player.color,roughness:.9}):new T.MeshPhysicalMaterial({color:player.color,roughness:.9,sheen:.45,sheenRoughness:.8,sheenColor:0xfff3d9});
    const ivory=compact?new T.MeshStandardMaterial({color:0xeee7d7,roughness:.88}):new T.MeshPhysicalMaterial({color:0xeee7d7,roughness:.88,sheen:.35,sheenRoughness:.8,sheenColor:0xfff4df});
    this.clothing=[this.robe,ivory];
    const skin=new T.MeshStandardMaterial({color:0xc49978,roughness:.79});
    const hair=new T.MeshStandardMaterial({color:0x34291f,roughness:.87});
    const hairLight=compact?hair:new T.MeshStandardMaterial({color:0x55402d,roughness:.83});
    const eye=compact?hair:new T.MeshStandardMaterial({color:0x283537,roughness:.45});
    const lips=compact?skin:new T.MeshStandardMaterial({color:0x865d4e,roughness:.9});
    const gold=new T.MeshStandardMaterial({color:0xb8a174,metalness:.5,roughness:.4});
    const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,parent:T.Group=this.body)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
    const line=(points:number[][],radius:number,material:T.Material,parent:T.Group=this.body)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),compact?8:20,radius,compact?4:6,false),material,0,0,0,parent);
    const cloth=this.cloth=new T.LatheGeometry([new T.Vector2(.40,.1),new T.Vector2(.39,.18),new T.Vector2(.36,.38),new T.Vector2(.33,.53),new T.Vector2(.31,.68),new T.Vector2(.28,.83),new T.Vector2(.25,.98),new T.Vector2(.24,1.1),new T.Vector2(.235,1.2),new T.Vector2(.25,1.28)],segments(48));
    const pos=cloth.attributes.position;
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i),a=Math.atan2(pos.getZ(i),pos.getX(i));
      const fold=(Math.sin(a*14+y*.6)*.07+Math.sin(a*23)*.015)*(1.35-y*.45);
      pos.setX(i,pos.getX(i)*(1+fold));pos.setZ(i,pos.getZ(i)*(1+fold)*.77);
    }cloth.computeVertexNormals();this.clothRest=new Float32Array(pos.array);if(pos instanceof T.BufferAttribute)pos.setUsage(T.DynamicDrawUsage);add(cloth,this.robe,0,0,0,this.skirt);
    const torso=add(new T.LatheGeometry([new T.Vector2(.25,0),new T.Vector2(.235,.13),new T.Vector2(.275,.34),new T.Vector2(.29,.42),new T.Vector2(.23,.49),new T.Vector2(.105,.55)],segments(40)),ivory,0,1.2,0);torso.scale.z=.69;
    const cape=new T.LatheGeometry([new T.Vector2(.27,1.22),new T.Vector2(.3,1.38),new T.Vector2(.34,1.56),new T.Vector2(.12,1.76)],segments(40),-Math.PI/2,Math.PI);
    const cp=cape.attributes.position;
    for(let i=0;i<cp.count;i++){const y=cp.getY(i),a=Math.atan2(cp.getZ(i),cp.getX(i));cp.setZ(i,cp.getZ(i)*.8+Math.sin(a*12+y)*.028*(1.9-y));}
    cape.computeVertexNormals();add(cape,ivory,0,0,.028);
    for(const side of [-1,1])line([[side*.12,1.76,.03],[side*.34,1.56,.02],[side*.3,1.38,.02],[side*.27,1.22,.02]],.009,gold);
    const belt=add(new T.CylinderGeometry(.252,.256,.045,segments(32)),gold,0,1.235,0);belt.scale.z=.78;
    add(new T.TorusGeometry(.04,.009,6,segments(20)),gold,.045,1.235,-.203);
    line([[.03,1.24,-.208],[.07,1.05,-.215],[.08,.89,-.24]],.012,gold);
    add(new T.CylinderGeometry(.075,.1,.15,12),skin,0,1.81,0);
    const head=add(new T.SphereGeometry(.14,segments(32),segments(24)),skin,0,1.995,0);head.scale.set(.95,1.18,.92);
    const crown=add(new T.SphereGeometry(.147,segments(32),segments(20),0,Math.PI*2,0,Math.PI*.57),hair,0,2.037,.018);crown.scale.set(.97,.98,1);
    const backHair=add(new T.SphereGeometry(.143,segments(24),segments(16)),hair,0,1.98,.084);backHair.scale.set(.98,1.24,.49);
    add(new T.SphereGeometry(.025,segments(16),segments(12)),skin,0,1.98,-.128).scale.set(.7,1.25,1.3);
    add(new T.SphereGeometry(.013,segments(12),segments(8)),skin,0,2.015,-.119).scale.set(1,2,1);
    for(const side of [-1,1]){
      add(new T.SphereGeometry(.025,segments(16),segments(12)),skin,side*.131,1.987,.001).scale.set(.5,1.5,.85);
      add(new T.SphereGeometry(.016,segments(16),segments(12)),ivory,side*.046,2.018,-.118).scale.set(1.2,.65,.45);
      add(new T.SphereGeometry(.008,segments(12),segments(8)),eye,side*.046,2.018,-.125).scale.set(.85,1,.5);
      line([[side*.026,2.045,-.112],[side*.047,2.051,-.113],[side*.068,2.043,-.103]],.004,hair);
      for(let strand=0;strand<(compact?2:5);strand++){
        const d=strand*.014;
        line([[side*(.03+d),2.158,-.008],[side*(.11+d*.3),2.10,-.07+d],[side*(.132+d*.12),1.98,-.025+d],[side*(.11+d*.3),1.87,.055+d*.4]],.014,strand%2?hairLight:hair);
      }
    }
    line([[-.028,1.941,-.108],[0,1.935,-.121],[.028,1.941,-.108]],.0035,lips);
    // Soft diagonal linen stole instead of a rigid metallic box across the chest.
    const stole=add(new T.PlaneGeometry(.12,.63,compact?1:3,compact?3:12),this.robe,.12,1.49,-.207);stole.rotation.z=-.22;stole.material.side=T.DoubleSide;
    line([[.05,1.78,-.12],[.09,1.59,-.211],[.14,1.35,-.208],[.15,1.20,-.208]],.008,gold);
    for(const side of [-1,1]){
      const arm=side===-1?this.left:this.right;arm.position.set(side*.3,1.61,0);this.body.add(arm);
      add(new T.SphereGeometry(.115,segments(20),segments(16)),ivory,0,0,0,arm);
      const sleeve=add(new T.LatheGeometry([new T.Vector2(.1,-.32),new T.Vector2(.105,-.12),new T.Vector2(.112,.02)],segments(24)),ivory,side*.025,0,0,arm);sleeve.rotation.z=side*.1;
      const forearm=new T.Group();forearm.position.set(side*.055,-.31,0);arm.add(forearm);this.forearms.push(forearm);
      add(new T.SphereGeometry(.101,segments(16),segments(12)),ivory,0,0,0,forearm);
      add(new T.LatheGeometry([new T.Vector2(.119,-.25),new T.Vector2(.13,-.19),new T.Vector2(.1,0)],segments(24)),ivory,0,0,0,forearm);
      const cuff=add(new T.CylinderGeometry(.119,.12,.025,segments(24)),gold,0,-.248,0,forearm);cuff.scale.z=.87;
      add(new T.SphereGeometry(.052,segments(16),segments(12)),skin,0,compact?-.338:-.314,-.004,forearm).scale.set(1,compact?1.8:1.35,.55);
      if(!compact)for(let finger=0;finger<4;finger++)add(new T.CapsuleGeometry(.010,.05,4,8),skin,side*(-.035+finger*.021),-.375+(finger===3?.012:0),-.012,forearm);
      const thumb=add(new T.CapsuleGeometry(.014,.035,4,8),skin,-side*.057,-.319,-.015,forearm);thumb.rotation.z=-side*.4;
      const leg=new T.Group();leg.position.set(side*.14,.32,0);this.root.add(leg);this.legs.push(leg);
      add(new T.CylinderGeometry(.08,.07,.3,10),ivory,0,-.08,0,leg);
      add(new T.SphereGeometry(.09,12,8),hair,0,-.25,-.045,leg).scale.set(.8,.6,1.6);
      add(new T.BoxGeometry(.12,.015,.04),gold,0,-.215,-.076,leg);
    }
    // Batch rigid detail by material while keeping the limbs independently animated.
    // A hip pivot, separate folded skirt, and articulated elbows allow real
    // kneeling/bowing without scaling the head or sinking the whole mesh.
    for(const child of this.body.children)child.position.y-=1.2;
    this.body.position.y=1.2;
    for(const group of [this.body,this.left,this.right,...this.forearms,...this.legs])batchRigidParts(group);
    // A translucent contact patch anchors feet without a heavy per-player light.
    const patch=new T.Mesh(new T.CircleGeometry(.41,24),new T.MeshBasicMaterial({color:0x233b43,transparent:true,opacity:.12,depthWrite:false}));patch.rotation.x=-Math.PI/2;patch.position.y=.028;this.root.add(patch);
    this.label=new T.Sprite(new T.SpriteMaterial({transparent:true,depthWrite:false,toneMapped:false,sizeAttenuation:false}));this.label.position.y=2.53;this.root.add(this.label);
    this.update(player);
  }
  update(player:Player,showPlayerNames=true){
    this.posture=player.posture??'standing';
    if(this.robeColor!==player.color){this.robeColor=player.color;this.robe.color.set(player.color).lerp(this.clothTint,.7);}
    const emote=player.emoteUntil>Date.now()?({heart:'♡',peace:'☮',pray:'✧',none:''})[player.emote]:'';
    this.displayingName=player.id==='builder'||showPlayerNames;
    const name=this.displayingName?player.name:'';
    this.label.visible=Boolean(name||emote);
    const signature=name+emote;if(signature===this.signature)return;this.signature=signature;
    if(!this.label.visible)return;
    const canvas=document.createElement('canvas'),c=canvas.getContext('2d')!;
    const font='600 38px Arial, sans-serif';c.font=font;
    const characters=Array.from(`${emote?emote+'  ':''}${name}`.trim());
    let text=characters.join('');
    while(c.measureText(text).width>444&&characters.length){characters.pop();text=characters.join('')+'…';}
    canvas.width=Math.ceil(c.measureText(text).width+36);canvas.height=80;
    c.fillStyle='rgba(15,30,43,.94)';c.strokeStyle=player.id==='builder'?'#e6c779':'rgba(235,222,189,.65)';c.lineWidth=2;
    c.beginPath();c.roundRect(2,4,canvas.width-4,72,14);c.fill();c.stroke();
    c.font=font;c.textAlign='center';c.textBaseline='middle';c.fillStyle=player.id==='builder'?'#ffe3a0':'#fffaf0';c.fillText(text,canvas.width/2,41);
    this.labelAspect=canvas.width/canvas.height;
    const old=this.label.material.map;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
    this.label.material.map=texture;this.label.material.needsUpdate=true;old?.dispose();
  }
  setLabelViewport(height:number,fov:number){
    // Constant screen size: names stay sharp/readable when zooming or on mobile.
    const scale=36*2*Math.tan(T.MathUtils.degToRad(fov/2))/Math.max(1,height);
    this.label.scale.set(scale*this.labelAspect,scale,1);
  }
  setEncouragement(strength:number,confirmed=false){return applyPersonalRitualTint(this.clothing,strength,confirmed);}
  get nameVisible(){return this.displayingName&&this.label.visible;}
  get readyToWalk(){return this.kneeling<.025;}
  get poseAmount(){return this.kneeling;}
  get bubbleHeight(){return this.label.position.y+.65;}
  animate(time:number,moving:boolean,reduced:boolean,running=false){
    const dt=Math.min(.05,Math.max(0,time-this.lastTime));this.lastTime=time;
    const blend=reduced?1:1-Math.exp(-dt*9);
    const kneel=this.posture!=='standing'&&!moving;
    this.kneeling=T.MathUtils.lerp(this.kneeling,kneel?1:0,blend);
    const k=this.kneeling;
    const angle=this.posture==='prostrate'?-1.94:this.posture==='confession'?-.4:-.12;
    this.lean=T.MathUtils.lerp(this.lean,kneel?angle:0,blend);
    const gait=moving&&!reduced?Math.sin(time*(running?11:7.2))*(running?.46:.28)*(1-k):0;
    const breathing=reduced?0:moving?Math.abs(Math.sin(time*7.2))*.015:Math.sin(time*1.3)*.005;
    this.body.position.set(0,1.2-.64*k+breathing,.08*k);
    this.body.rotation.x=this.lean;
    this.body.rotation.z=gait*.035;
    if([k,this.lean,breathing].some((value,i)=>Math.abs(value-this.clothPose[i])>.0005)){
      const vertices=this.cloth.attributes.position;
      for(let i=0;i<vertices.count;i++){
        const p=robeVertex(this.clothRest[i*3],this.clothRest[i*3+1],this.clothRest[i*3+2],k,this.lean,breathing);
        vertices.setXYZ(i,p.x,p.y,p.z);
      }
      vertices.needsUpdate=true;this.cloth.computeVertexNormals();this.cloth.computeBoundingSphere();
      this.clothPose=[k,this.lean,breathing];
    }
    this.legs.forEach((leg,i)=>{leg.position.y=.32-.18*k;leg.position.z=.12*k;leg.rotation.x=-Math.PI/2*k+gait*(i?1:-1);});
    const bow=this.posture==='prostrate',confess=this.posture==='confession';
    [this.left,this.right].forEach((arm,i)=>{
      const side=i?1:-1;
      // Counter-rotate at the shoulders when the torso bows, so the palms
      // reach the ground ahead of the knees instead of lifting behind the back.
      const upper=bow?3.05:confess?.5:.4;
      const elbow=bow?-.25:confess?2.25:1.9;
      arm.rotation.x=T.MathUtils.lerp(arm.rotation.x,kneel?upper:gait*(i?-1:1)-.06,blend);
      arm.rotation.z=T.MathUtils.lerp(arm.rotation.z,kneel?-side*(bow?.15:.38):0,blend);
      this.forearms[i].rotation.x=T.MathUtils.lerp(this.forearms[i].rotation.x,kneel?elbow:0,blend);
      this.forearms[i].rotation.z=T.MathUtils.lerp(this.forearms[i].rotation.z,kneel&&!bow?-side*.45:0,blend);
    });
    this.label.position.y=2.53-.64*k-Math.min(1,Math.abs(this.lean))* .7;
    this.label.position.z=-Math.sin(-this.lean)*.65;
  }
  dispose(){disposeTree(this.root);}
}

export function batchRigidParts(group:T.Group){
  const batches=new Map<T.Material,T.BufferGeometry[]>();
  for(const child of [...group.children]){
    if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;
    child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    if(flat!==geometry)geometry.dispose();
    const list=batches.get(child.material)??[];list.push(flat);batches.set(child.material,list);
    group.remove(child);child.geometry.dispose();
  }
  for(const [material,parts] of batches){
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    if(geometry){const mesh=new T.Mesh(geometry,material);mesh.castShadow=!(material instanceof T.MeshBasicMaterial&&material.transparent);mesh.receiveShadow=true;group.add(mesh);}
  }
}

export function disposeTree(root:T.Object3D){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  root.traverse(obj=>{
    if(obj instanceof T.Mesh||obj instanceof T.Points||obj instanceof T.Sprite){
      if('geometry' in obj)geometries.add(obj.geometry);
      for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);}
    }
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
