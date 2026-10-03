import * as T from 'three';
import { SANCTUARY_FOCUS } from '../../shared/places';
import { toWorld } from './coordinates';

// Presentation only: this is daylight through architecture, not a deity/entity.
export const SANCTUARY_LIGHT={...toWorld(SANCTUARY_FOCUS),height:27.4,radius:4.5} as const;

export function createSanctuaryLight(scene:T.Scene,small:boolean){
  const root=new T.Group();root.name='sanctuary-daylight';scene.add(root);
  root.position.set(SANCTUARY_LIGHT.x,0,SANCTUARY_LIGHT.z);
  // A handful of soft shells approximate airborne scattering. No full-screen
  // ray marcher, shadow maps or per-frame textures; avatars keep depth priority.
  const count=small?4:6;
  const shells:T.ShaderMaterial[]=[];
  for(let i=0;i<count;i++){
    const fraction=(i+1)/count;
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
      uniforms:{strength:{value:.42/count}},
      vertexShader:`varying vec3 vWorld;varying vec3 vNormal;varying vec2 vUv;
        void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`uniform float strength;varying vec3 vWorld;varying vec3 vNormal;varying vec2 vUv;
        void main(){vec3 view=normalize(cameraPosition-vWorld);
          float edge=pow(abs(dot(normalize(vNormal),view)),1.4);
          float height=smoothstep(0.,.045,vUv.y)*(1.-smoothstep(.96,1.,vUv.y));
          float haze=(.7+.3*sin(vUv.y*2.7))*(.3+.7*smoothstep(.8,5.,vWorld.y));
          gl_FragColor=vec4(1.,.94,.79,strength*edge*height*haze);}`});
    shells.push(material);
    const shell=new T.Mesh(new T.CylinderGeometry(3.9*fraction,4.5*fraction,SANCTUARY_LIGHT.height,small?40:64,1,true),material);
    shell.position.y=SANCTUARY_LIGHT.height/2;root.add(shell);
  }
  const pool=new T.Mesh(new T.PlaneGeometry(13,13),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{strength:{value:.22}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float strength;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float a=pow(1.-smoothstep(.12,1.,r),2.)*strength;gl_FragColor=vec4(1.,.94,.79,a);}'}));
  pool.rotation.x=-Math.PI/2;pool.position.y=.045;root.add(pool);
  // The opening stays open: the light source is outside, not an emissive orb.
  const daylight=new T.SpotLight(0xfff0d5,260,40,.25,1,1.4);daylight.position.set(0,26.5,0);daylight.target.position.set(0,0,0);root.add(daylight,daylight.target);
  const dustGeometry=new T.BufferGeometry(),positions=new Float32Array((small?65:110)*3);
  for(let i=0;i<positions.length/3;i++){
    const a=i*2.39996,r=Math.sqrt((i*.618034)%1)*3.5;
    positions[i*3]=Math.cos(a)*r;positions[i*3+1]=.7+(i*1.371)%25;positions[i*3+2]=Math.sin(a)*r;
  }
  dustGeometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0xfff1ce,size:.035,transparent:true,opacity:.38,depthWrite:false}));root.add(dust);
  let previous=-1;
  function setEncouragement(value:number){
    const strength=Number.isFinite(value)?T.MathUtils.clamp(value,0,1):0;
    if(strength===previous)return;previous=strength;
    for(const material of shells)material.uniforms.strength.value=.42/count*(1+.25*strength);
    pool.material.uniforms.strength.value=.22*(1+.18*strength);
    daylight.intensity=260*(1+.12*strength);
  }
  // Reuses existing materials/light: no extra meshes, passes, particles or timers.
  return {root,dust,setEncouragement};
}
