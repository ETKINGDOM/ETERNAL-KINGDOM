import * as T from 'three';
import { portalsFor, PORTAL_TRIGGER_RADIUS, type Scene } from '../../shared/scenes';
import { toWorld } from './coordinates';
import { batchRigidParts } from './Pilgrim3D';

export function createMapPortals(scene:T.Scene,kind:Scene){
  if(!portalsFor(kind).length)return [];
  const stone=new T.MeshStandardMaterial({color:0xdddac9,roughness:.8});
  const gold=new T.MeshStandardMaterial({color:0xc7ac70,metalness:.35,roughness:.45});
  return portalsFor(kind).map(portal=>{
    const root=new T.Group(),p=toWorld(portal);root.position.set(p.x,0,p.z);root.rotation.y=portal.yaw;
    root.userData.portalId=portal.id;scene.add(root);
    const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);};
    for(const x of [-2.4,2.4]){
      add(new T.CylinderGeometry(.23,.34,4.2,12),stone,x,2.1,0);
      add(new T.BoxGeometry(.85,.25,.85),gold,x,.125,0);
    }
    const points=Array.from({length:25},(_,i)=>new T.Vector3(Math.cos(i/24*Math.PI)*2.4,4.1+Math.sin(i/24*Math.PI)*2.4,0));
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.25,8,false),stone,0,0,0);
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.035,6,false),gold,0,0,.28);
    add(new T.BoxGeometry(4.9,.05,2),stone,0,.025,0);
    // An empty arch, not a wall or an invisible instant-teleport button.
    batchRigidParts(root);
    // Ground-level cue aligned with the actual scene transition, including
    // return arches. No new lights, textures or per-frame animation on phones.
    const halo=new T.Group();halo.name='map-entry-halo';root.add(halo);
    const ring=new T.Mesh(new T.RingGeometry(PORTAL_TRIGGER_RADIUS+.10,PORTAL_TRIGGER_RADIUS+.18,48),new T.MeshBasicMaterial({color:0xffd886,transparent:true,opacity:.92,depthWrite:false,toneMapped:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.072;halo.add(ring);
    const glow=new T.Mesh(new T.PlaneGeometry(2.8,2.8),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float ring=exp(-pow((r-.60)*8.,2.));float a=(ring*.28+max(0.,1.-r)*.055)*(1.-smoothstep(.78,1.,r));gl_FragColor=vec4(1.,.82,.48,a);}'}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.066;halo.add(glow);
    return {portal,root,halo,anchor:new T.Vector3(p.x,4.3,p.z)};
  });
}
