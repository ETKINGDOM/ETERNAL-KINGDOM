import * as T from 'three';

export type RitualGlowPoint={x:number;y:number;z:number};
/** Reuses only the local avatar's clothing; never a shadow-casting light. */
export function applyPersonalRitualTint(materials:readonly T.MeshStandardMaterial[],strength:number,confirmed=false){
  const amount=Number.isFinite(strength)?T.MathUtils.clamp(strength,0,1):0;
  for(const material of materials){material.emissive.setHex(0xffd587);material.emissiveIntensity=(confirmed?1.25:.32)*amount;}
  return amount;
}
type GlowView={rotation:T.Quaternion;age:number;height:number;confirmed:boolean};
/** Two four-vertex quads: feet and a camera-facing body aura. No real light,
 * bloom dependency, textures, particle system or multiplayer broadcast. */
export function createPersonalRitualGlow(scene:T.Scene){
  let mesh:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>|null=null;
  let aura:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>|null=null;
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  function update(point:RitualGlowPoint|null,strength:number,view?:GlowView){
    const amount=Number.isFinite(strength)?T.MathUtils.clamp(strength,0,1):0;
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z)||amount<=0){if(mesh)mesh.visible=false;if(aura)aura.visible=false;return;}
    if(!mesh){
      const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.NormalBlending,
        uniforms:{strength:{value:0},arrival:{value:1}},vertexShader,
        fragmentShader:'uniform float strength;uniform float arrival;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float core=pow(1.-smoothstep(.12,1.,r),2.);float ring=1.-smoothstep(.018,.075,abs(r-(.38+.30*arrival)));float outer=1.-smoothstep(.012,.045,abs(r-.84));float a=(core*.28+ring*.85+outer*.30)*strength;gl_FragColor=vec4(1.,.69,.17,a);}'});
      mesh=new T.Mesh(new T.PlaneGeometry(3.6,3.6),material);mesh.name='personal-ritual-encouragement';
      mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);
    }
    mesh.visible=true;mesh.position.set(point.x,point.y+.046,point.z);
    mesh.material.uniforms.strength.value=amount;
    const age=view&&Number.isFinite(view.age)?Math.max(0,view.age):0;
    mesh.material.uniforms.arrival.value=view?.confirmed?Math.min(1,age/1.2):1;
    if(!view?.confirmed){if(aura)aura.visible=false;return;}
    if(!aura){
      const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.NormalBlending,side:T.DoubleSide,
        uniforms:{strength:{value:0},age:{value:0}},vertexShader,
        fragmentShader:`uniform float strength;uniform float age;varying vec2 vUv;
          void main(){
            vec2 p=(vUv-.5)*2.;float r=length(p);float edge=1.-smoothstep(.86,1.,r);
            float halo=exp(-pow((r-.67)*6.,2.))*.55;
            float core=(1.-smoothstep(.08,.80,r))*.12;
            float ray=pow(abs(cos(atan(p.y,p.x)*7.)),18.)*smoothstep(.25,.65,r)*.21;
            float arrival=1.-smoothstep(1.0,1.8,age);
            float burst=exp(-pow((r-(.15+min(age/1.4,1.)*.68))*20.,2.))*arrival*.65;
            float sparks=0.;
            for(int i=0;i<6;i++){
              float n=float(i);float x=sin(n*2.4)*.63;
              float y=fract(n*.173+min(age,16.)*.065)*1.5-.75;
              vec2 q=p-vec2(x,y);float d=abs(q.x)+abs(q.y)*.70;
              sparks+=pow(1.-smoothstep(.0,.075,d),2.)*.75;
            }
            float a=min(.80,(halo+core+ray+burst+sparks)*edge)*strength;
            gl_FragColor=vec4(mix(vec3(1.,.68,.15),vec3(1.,.95,.68),min(1.,core+sparks+burst)),a);
          }`});
      aura=new T.Mesh(new T.PlaneGeometry(2.25,3.35),material);aura.name='personal-ritual-body-aura';
      aura.castShadow=false;aura.receiveShadow=false;scene.add(aura);
    }
    const height=Number.isFinite(view.height)?T.MathUtils.clamp(view.height,.8,2.4):2.4;
    aura.visible=true;aura.quaternion.copy(view.rotation);aura.scale.y=height/2.4;
    aura.position.set(point.x,point.y+height*.5,point.z);
    aura.material.uniforms.strength.value=amount;aura.material.uniforms.age.value=Math.min(18,age);
  }
  // Owned/disposed with the scene. Nothing is allocated until a visible cue.
  return {update};
}
