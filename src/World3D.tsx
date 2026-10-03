import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Eye, RotateCcw } from 'lucide-react';
import type { Player } from '../shared/protocol';
import { atSanctuaryGate, canTravel, groundHeight, sanctuaryApproach, SPAWN, MOVEMENT_SPEED, visitAreaAt, type Point } from '../shared/world';
import { isScenic, portalsFor, portalAt, SCENE_INFO } from '../shared/scenes';
import { createMapPortals } from './three/MapPortals';
import { SANCTUARY_PLACES, type SanctuaryAction } from '../shared/places';
import { createWorldPlaces } from './three/WorldPlaces';
import { walkingRoute } from './navigation';
import { toProtocol, toWorld } from './three/coordinates';
import { addSky, buildArchitecture } from './three/SacredArchitecture';
import { Pilgrim3D, disposeTree } from './three/Pilgrim3D';
import {StandBeforeWalking} from './standBeforeWalking';
import SpeechBubbles, { placeBubble, type BubbleElements } from './SpeechBubbles';
import type { WorldRendererProps } from './worldRenderers';
import { AdaptiveResolution, renderPixelRatio, useCompactRendering } from './renderQuality';
import {WorldFrameBudget,CachedPassBudget,shadowPoseKey,DESKTOP_SHADOW_SIZE,DESKTOP_REFLECTION_SIZE,DESKTOP_PASS_REFRESH} from './renderEnergy';
import NameVisibilityButton from './NameVisibilityButton';
import { SANCTUARY_LIGHT } from './three/SanctuaryLight';
import {ritualLightStrength} from './ritualLight';
import {createPersonalRitualGlow} from './three/PersonalRitualGlow';
import { STREET_FEATURES } from '../shared/market';
import { createStreetInteractions } from './three/StreetInteractions';

const BUILDER:Player={x:815,y:575,color:'#eee2c6',name:'The Builder',id:'builder',emote:'none',emoteUntil:0};

export default function World3D(props:WorldRendererProps){
  const canvas=useRef<HTMLCanvasElement>(null);const current=useRef(props);current.current=props;
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [firstPerson,setFirstPerson]=useState(false);const first=useRef(firstPerson);first.current=firstPerson;
  useEffect(()=>{if(props.ritualLightCue?.state==='confirmed'&&props.ritualLightCue.startedAt===null)setFirstPerson(false);},[props.ritualLightCue?.id]);
  const reset=useRef(()=>{});
  const bubbleElements=useRef<BubbleElements>(new Map());
  const doorHint=useRef<HTMLButtonElement>(null);const walkToDoor=useRef(()=>{});
  const markers=useRef(new Map<string,HTMLButtonElement>());
  const walkToPoint=useRef<(point:Point)=>void>(()=>{});
  const [placesOpen,setPlacesOpen]=useState(false);
  const [streetOpen,setStreetOpen]=useState(false);
  useEffect(()=>{
    const el=canvas.current!;setState('loading');
    const compactDevice=useCompactRendering({width:innerWidth,height:innerHeight,coarsePointer:matchMedia('(pointer: coarse)').matches,touchPoints:navigator.maxTouchPoints,mobile:/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)},props.quality);
    let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({canvas:el,antialias:!compactDevice,powerPreference:compactDevice?'default':'high-performance'});}catch{setState('error');return;}
    const gl=renderer.getContext();const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const software=debug?/swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):false;
    const small=compactDevice||software;
    const adaptive=new AdaptiveResolution();
    const frames=new WorldFrameBudget();
    const shadows=new CachedPassBudget(DESKTOP_PASS_REFRESH.shadowActive,DESKTOP_PASS_REFRESH.idle);
    const reflections=new CachedPassBudget(DESKTOP_PASS_REFRESH.reflectionActive,DESKTOP_PASS_REFRESH.idle);
    renderer.shadowMap.enabled=!small;renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.outputColorSpace=T.SRGBColorSpace;
    const scene=new T.Scene();scene.fog=new T.FogExp2(0xb0c6ce,.005);addSky(scene);
    const camera=new T.PerspectiveCamera(57,1,.12,350);
    let env:T.WebGLRenderTarget|undefined;
    if(!small){const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();env=pmrem.fromScene(room,.05);scene.environment=env.texture;scene.environmentIntensity=.3;room.dispose();pmrem.dispose();}
    const hemi=new T.HemisphereLight(0xc6dcf7,0x364958,small?1.05:.85);scene.add(hemi);
    const sun=new T.DirectionalLight(0xffe4b1,props.scene==='temple'?1.8:3.1);sun.position.set(-35,props.scene==='temple'?16:24,-18);sun.target.position.set(0,0,-8);scene.add(sun,sun.target);sun.castShadow=!small;
    sun.shadow.mapSize.set(DESKTOP_SHADOW_SIZE,DESKTOP_SHADOW_SIZE);Object.assign(sun.shadow.camera,{left:-40,right:40,top:45,bottom:-40,near:1,far:100});sun.shadow.bias=-.0003;sun.shadow.normalBias=.055;
    const altarLight=new T.PointLight(0xffdfaa,90,42,2);altarLight.position.set(0,9,-26);scene.add(altarLight);
    const architecture=buildArchitecture(scene,props.scene,small);
    const personalGlow=createPersonalRitualGlow(scene);
    const places=createWorldPlaces(scene,props.scene,small);
    const portals=createMapPortals(scene,props.scene);
    const street=createStreetInteractions(scene,props.scene);
    const hasBuilder=!isScenic(props.scene);
    // Mobile never allocates the bloom/composer render targets. Tone mapping and
    // output conversion are handled by the renderer on the direct-render path.
    let composer:EffectComposer|undefined,bloom:UnrealBloomPass|undefined,output:OutputPass|undefined;
    if(!small){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new T.Vector2(1,1),.18,.55,1.5);composer.addPass(bloom);output=new OutputPass();composer.addPass(output);}
    el.dataset.quality=small?'performance':'standard';el.dataset.frameTarget=small?'30':'60';
    el.dataset.shadows=String(renderer.shadowMap.enabled);el.dataset.postprocessing=String(Boolean(composer));
    el.dataset.shadowSize=String(small?0:DESKTOP_SHADOW_SIZE);el.dataset.reflectionSize=String(architecture.reflection?DESKTOP_REFLECTION_SIZE:0);
    el.dataset.avatarDetail=small?'compact':'full';
    const figures=new Map<string,Pilgrim3D>();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const keys=new Set<string>();let position:Point|null=null;let selfId='';let lastServer:Point|null=null;let target:Point|null=null;
    let route:Point[]=[];let arrivalYaw:number|null=null;let gateTriggered=false;let lastPosture='standing';const standing=new StandBeforeWalking();
    let stopWalkingSignal=current.current.stopWalkingSignal;
    let motionStopped=false;
    let frame=0,lastTime=0,lastSent=0,yaw=0,pitch=-.035,distance=9,drag:{x:number;y:number;lastX:number;lastY:number;moved:boolean;id:number}|null=null;
    let size={w:0,h:0};let disposed=false;let ready=false;let pixelRatio=0;let reportedReady=false;
    let observedPlayers:Player[]|null=null,observedPostures='',observedFirst=first.current,observedNames=props.showPlayerNames;
    let renderTime=0,renderedFrames=0,shadowUpdates=0,reflectionUpdates=0;
    if(architecture.reflection){
      const reflection=architecture.reflection,renderReflection=reflection.onBeforeRender;
      const reflectedPosition=new T.Vector3(),reflectedRotation=new T.Quaternion(),reflectedProjection=new T.Matrix4();let captured=false;
      reflection.onBeforeRender=function(...args){
        const camera=args[2];
        // A changed camera needs a fresh projective reflection immediately, not
        // a stale texture matrix sliding across the floor. Stationary views cache.
        const changed=!captured||camera.position.distanceToSquared(reflectedPosition)>1e-6||camera.quaternion.angleTo(reflectedRotation)>.0005||!camera.projectionMatrix.equals(reflectedProjection);
        if(!reflections.take(renderTime,frames.recent(renderTime),changed))return;
        renderReflection.apply(this,args);captured=true;reflectedPosition.copy(camera.position);reflectedRotation.copy(camera.quaternion);reflectedProjection.copy(camera.projectionMatrix);reflectionUpdates++;
      };
    }
    const raycaster=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0),intersection=new T.Vector3();
    const cameraPosition=new T.Vector3(),look=new T.Vector3(),head=new T.Vector3();
    // Measure labels on resize, not after transform writes on every frame.
    const markerSizes=new Map<Element,{w:number;h:number}>();
    const markerObserver=new ResizeObserver(entries=>{for(const entry of entries){
      const box=entry.borderBoxSize[0];
      if(box)markerSizes.set(entry.target,{w:box.inlineSize,h:box.blockSize});
    }});
    for(const button of markers.current.values())markerObserver.observe(button);
    const seed=toWorld(SPAWN[props.scene]);camera.position.set(seed.x,3.8,seed.z+distance);camera.lookAt(seed.x,3.3,seed.z-16);
    reset.current=()=>{yaw=0;pitch=-.035;distance=9;frames.wake(performance.now());};
    walkToDoor.current=()=>{
      if(!position||!current.current.active)return;
      arrivalYaw=null;
      frames.wake(performance.now());
      route=props.scene==='plaza'?sanctuaryApproach(position):walkingRoute(props.scene,position,{x:600,y:778});
      if(!route.length)route=walkingRoute(props.scene,position,{x:600,y:190});
      target=route.shift()??null;keys.clear();el.focus();
    };
    walkToPoint.current=point=>{if(!position||!current.current.active)return;frames.wake(performance.now());route=walkingRoute(props.scene,position,point);arrivalYaw=null;target=route.shift()??null;keys.clear();el.focus();};
    const keyboard=(e:KeyboardEvent)=>{
      if(!current.current.active||(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select,button')||e.target.isContentEditable)))return;
      const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();frames.wake(performance.now());keys.add(key);target=null;route=[];}
    };
    const keyup=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
    const blur=()=>{keys.clear();target=null;route=[];drag=null;standing.reset();current.current.movementInput?.clear();};
    // Browsers may suspend rAF before its first hidden tick. Clear held input
    // on visibilitychange too, without touching audio, the room or receipts.
    const pause=()=>{blur();lastTime=0;frames.reset();adaptive.reset();};
    const visibility=()=>{if(document.hidden)pause();};
    const down=(e:PointerEvent)=>{el.focus({preventScroll:true});if(!current.current.active)return;frames.wake(performance.now());drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,id:e.pointerId};el.setPointerCapture(e.pointerId);};
    const pointerMove=(e:PointerEvent)=>{
      if(!drag||drag.id!==e.pointerId)return;
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;
      if(drag.moved){yaw-=(e.clientX-drag.lastX)*.004;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.lastY)*.003,-.32,.65);target=null;route=[];}
      drag.lastX=e.clientX;drag.lastY=e.clientY;
    };
    const up=(e:PointerEvent)=>{
      if(!drag||drag.id!==e.pointerId)return;const clicked=!drag.moved;drag=null;
      if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
      if(!clicked||!current.current.active)return;
      const rect=el.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      const streetHit=street.hit(raycaster);
      if(streetHit){setStreetOpen(false);setPlacesOpen(false);current.current.onInspectStreet(streetHit.id);return;}
      const stationHit=raycaster.intersectObjects(places.stations,true)[0];
      if(stationHit){let object:T.Object3D|null=stationHit.object;while(object&&!object.userData.sanctuaryAction)object=object.parent;if(object){current.current.onRitual(object.userData.sanctuaryAction as SanctuaryAction);return;}}
      const portalHit=raycaster.intersectObjects(portals.map(p=>p.root),true)[0];
      if(portalHit){let object:T.Object3D|null=portalHit.object;while(object&&!object.userData.portalId)object=object.parent;const portal=portals.find(p=>p.portal.id===object?.userData.portalId);if(portal){walkToPoint.current(portal.portal);return;}}
      const hits=raycaster.intersectObjects([...figures.values()].map(p=>p.root),true);
      for(const hit of hits){let obj:T.Object3D|null=hit.object;while(obj&&!obj.userData.personId)obj=obj.parent;const id=obj?.userData.personId;if(id&&id!==current.current.self){if(id==='builder')current.current.onGuide();else{const person=current.current.players.find(p=>p.id===id);if(person)current.current.onPerson(person);}return;}}
      if(architecture.door?.hit(raycaster.ray)){walkToDoor.current();return;}
      if(raycaster.ray.intersectPlane(plane,intersection))walkToPoint.current(toProtocol(intersection.x,intersection.z));
    };
    const wheel=(e:WheelEvent)=>{if(!current.current.active)return;e.preventDefault();frames.wake(performance.now());distance=T.MathUtils.clamp(distance+e.deltaY*.008,3.8,11);};
    const contextLost=(e:Event)=>{e.preventDefault();setState('error');cancelAnimationFrame(frame);current.current.onPresentationReady?.(false);};
    function draw(time:number){
      if(disposed)return;
      if(document.hidden){pause();frame=requestAnimationFrame(draw);return;}
      const state=current.current;
      if(state.players!==observedPlayers){
        observedPlayers=state.players;frames.wake(time);
        const postures=shadowPoseKey(state.players);
        if(postures!==observedPostures){observedPostures=postures;shadows.invalidate();reflections.invalidate();}
      }
      if(first.current!==observedFirst||state.showPlayerNames!==observedNames){observedFirst=first.current;observedNames=state.showPlayerNames;frames.wake(time);shadows.invalidate();reflections.invalidate();}
      const moving=state.active&&Boolean(keys.size||target||drag?.moved||state.movementInput?.read().engaged);
      const frameTarget=frames.target(time,small,state.active,moving,ritualLightStrength(state.ritualLightCue,time,reduced.matches)>0);
      if(el.dataset.frameTarget!==String(frameTarget))el.dataset.frameTarget=String(frameTarget);
      // An accumulated deadline avoids accidentally halving frame rate when a
      // 60 Hz tick falls just short of a 30 Hz deadline. Background time is lost.
      if(!frames.take(time,frameTarget)){frame=requestAnimationFrame(draw);return;}
      const dt=lastTime?Math.min((time-lastTime)/1000,.08):1/30;lastTime=time;
      if(small)adaptive.observe(time);
      const me=state.players.find(p=>p.id===state.self);
      // Cancel locally on the click, before a delayed server pose response.
      if(stopWalkingSignal!==state.stopWalkingSignal){stopWalkingSignal=state.stopWalkingSignal;keys.clear();route=[];target=null;motionStopped=true;}
      const before=position?{...position}:null;
      if(me&&selfId!==me.id){position={x:me.x,y:me.y};lastServer={...position};selfId=me.id;}
      if(!me){position=null;selfId='';standing.reset();}
      if(me&&position){
        const posture=me.posture??'standing';
        if(posture!==lastPosture){if(posture!=='standing'){target=null;route=[];keys.clear();motionStopped=true;position={x:me.x,y:me.y};}lastPosture=posture;standing.reset();}
        if(lastServer&&(lastServer.x!==me.x||lastServer.y!==me.y)){if(Math.hypot(me.x-position.x,me.y-position.y)>65)position={x:me.x,y:me.y};lastServer={x:me.x,y:me.y};}
        if(state.active){
          const touch=state.movementInput?.read();
          if(touch?.engaged){keys.clear();target=null;route=[];arrivalYaw=null;}
          const right=touch?.engaged?touch.x:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
          const forward=touch?.engaged?-touch.y:Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
          let dx=right*Math.cos(yaw)-forward*Math.sin(yaw),dz=-right*Math.sin(yaw)-forward*Math.cos(yaw);
          let remaining=Infinity;
          if(target&&!right&&!forward){const from=toWorld(position),to=toWorld(target);dx=to.x-from.x;dz=to.z-from.z;remaining=Math.hypot(dx,dz);if(remaining<.18){target=route.shift()??null;dx=dz=0;if(!target&&arrivalYaw!==null){yaw=arrivalYaw;arrivalYaw=null;}}}
          const length=Math.hypot(dx,dz);
          if(standing.shouldRequest(time,state.self,posture,Boolean(length),state.active))state.onStand();
          if(length&&posture==='standing'&&(figures.get(state.self)?.readyToWalk??true)){const p=toWorld(position);const step=Math.min(MOVEMENT_SPEED[state.running?'run':'walk']*dt*(touch?.engaged?Math.min(1,length):1),remaining);const next=toProtocol(p.x+dx/length*step,p.z+dz/length*step);
            motionStopped=false;
            if(canTravel(props.scene,position,next))position=next;
            else if(canTravel(props.scene,position,{x:next.x,y:position.y}))position.x=next.x;
            else if(canTravel(props.scene,position,{x:position.x,y:next.y}))position.y=next.y;
            else target=null;
          }
          if(!motionStopped&&posture==='standing'&&time-lastSent>110&&Math.hypot(me.x-position.x,me.y-position.y)>.5){state.move(position);lastSent=time;}
        }else{keys.clear();target=null;route=[];drag=null;standing.reset();}
      }
      const people=hasBuilder?[...state.players,BUILDER]:state.players;
      const live=new Set(people.map(p=>p.id));
      for(const [id,model] of figures)if(!live.has(id)){scene.remove(model.root);model.dispose();figures.delete(id);}
      for(const person of people){
        let model=figures.get(person.id);const p=toWorld(person.id===state.self&&position?position:person);
        if(!model){model=new Pilgrim3D(person,small?'compact':'full');model.root.position.set(p.x,0,p.z);figures.set(person.id,model);scene.add(model.root);}
        const oldX=model.root.position.x,oldZ=model.root.position.z;
        model.root.position.x=T.MathUtils.lerp(oldX,p.x,person.id===state.self?1:Math.min(1,dt*12));model.root.position.z=T.MathUtils.lerp(oldZ,p.z,person.id===state.self?1:Math.min(1,dt*12));
        model.root.position.y=T.MathUtils.lerp(model.root.position.y,groundHeight(props.scene,person.id===state.self&&position?position:person),Math.min(1,dt*18));
        const previous=person.id===state.self&&before?toWorld(before):{x:oldX,z:oldZ};const dx=model.root.position.x-previous.x,dz=model.root.position.z-previous.z;
        const moving=Math.hypot(dx,dz)>.004;
        if(moving){const angle=Math.atan2(-dx,-dz);model.root.rotation.y+=Math.atan2(Math.sin(angle-model.root.rotation.y),Math.cos(angle-model.root.rotation.y))*Math.min(1,dt*12);}
        if(person.id==='builder')model.root.rotation.y=Math.PI*.85;
        model.root.visible=!(person.id===state.self&&first.current);model.update(person,state.showPlayerNames);model.animate(time/1000,moving,reduced.matches,Math.hypot(dx,dz)/Math.max(dt,.001)>4.7);model.setLabelViewport(el.clientHeight,camera.fov);
        if(person.id!==state.self)model.setEncouragement(0);
      }
      const focus=toWorld(position??SPAWN[props.scene]);
      const elevation=groundHeight(props.scene,position??SPAWN[props.scene])-(first.current?(figures.get(state.self)?.poseAmount??0)*.65:0);
      const near=first.current;
      cameraPosition.set(focus.x+Math.sin(yaw)*(near?0:distance),elevation+(near?1.83:3.8+pitch*4),focus.z+Math.cos(yaw)*(near?0:distance));
      // Close orbit views frame the body, including a bowed pose, instead of
      // aiming over it and cropping the entire robe below the viewport.
      const close=near?0:T.MathUtils.clamp((9-distance)/5.2,0,1);
      const ahead=T.MathUtils.lerp(18,.8,close);
      const bodyFocus=T.MathUtils.lerp(3.8,1.2,close)-(figures.get(state.self)?.poseAmount??0)*.6*close;
      look.set(focus.x-Math.sin(yaw)*ahead,elevation+(near?1.83:bodyFocus)+pitch*T.MathUtils.lerp(15,4,close),focus.z-Math.cos(yaw)*ahead);
      camera.position.lerp(cameraPosition,reduced.matches?1:1-Math.exp(-dt*7));camera.lookAt(look);
      const width=Math.max(1,el.clientWidth),height=Math.max(1,el.clientHeight);
      const ratio=renderPixelRatio(width,height,devicePixelRatio,small,adaptive.scale);
      if(width!==size.w||height!==size.h||ratio!==pixelRatio){
        size={w:width,h:height};pixelRatio=ratio;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
        composer?.setPixelRatio(ratio);composer?.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
        adaptive.reset();el.dataset.pixelRatio=ratio.toFixed(2);el.dataset.resolutionScale=adaptive.scale.toFixed(2);
      }
      if(!reduced.matches)architecture.dust.position.y=Math.sin(time*.00013)*.3;
      const encouragement=me?ritualLightStrength(state.ritualLightCue,time,reduced.matches):0;
      el.dataset.ritualLightState=encouragement>0?state.ritualLightCue!.state:'idle';
      el.dataset.ritualLightKind=encouragement>0?state.ritualLightCue!.kind:'';
      el.dataset.ritualLightStrength=encouragement.toFixed(3);
      el.dataset.ritualLightTarget=encouragement>0?'self':'';
      const selfModel=figures.get(state.self);
      const confirmed=state.ritualLightCue?.state==='confirmed';
      el.dataset.personalRobeGlow=String(Boolean(selfModel&&selfModel.setEncouragement(encouragement,confirmed)>0));
      if(architecture.lightColumn){
        architecture.lightColumn.setEncouragement(encouragement);
        architecture.lightColumn.dust.position.y=reduced.matches?0:Math.sin(time*.00017)*.16;
        el.dataset.insideLight=String(Math.hypot(focus.x-SANCTUARY_LIGHT.x,focus.z-SANCTUARY_LIGHT.z)<SANCTUARY_LIGHT.radius);
      }else el.dataset.insideLight='false';
      const cueAge=state.ritualLightCue?.startedAt==null?0:Math.max(0,(time-state.ritualLightCue.startedAt)/1000);
      personalGlow.update(encouragement>0&&selfModel?selfModel.root.position:null,encouragement,{rotation:camera.quaternion,age:reduced.matches?0:cueAge,height:2.4-(selfModel?.poseAmount??0)*1.3,confirmed});
      el.dataset.personalBodyAura=String(Boolean(confirmed&&encouragement>0&&selfModel?.root.visible));
      el.dataset.ritualLightPhase=state.ritualLightCue?.startedAt===null?'waiting':encouragement>0?'visible':'idle';
      el.dataset.personalGlowX=encouragement>0&&selfModel?selfModel.root.position.x.toFixed(3):'';
      el.dataset.personalGlowZ=encouragement>0&&selfModel?selfModel.root.position.z.toFixed(3):'';
      el.dataset.lightColumn=String(Boolean(architecture.lightColumn));
      const door=architecture.door;
      const nearDoor=door?[focus,...state.players.map(toWorld)].sort((a,b)=>Math.hypot(a.x,a.z-door.root.position.z)-Math.hypot(b.x,b.z-door.root.position.z))[0]:focus;
      const doorOpen=door?.update(nearDoor,dt,reduced.matches)??0;
      el.dataset.doorOpen=doorOpen.toFixed(2);el.dataset.selfX=position?.x.toFixed(1)??'';el.dataset.selfY=position?.y.toFixed(1)??'';
      if(position&&state.active&&!gateTriggered&&doorOpen>.85&&atSanctuaryGate(props.scene,position)){
        gateTriggered=true;keys.clear();target=null;route=[];state.onTravel();
      }
      const exit=position&&state.active&&!gateTriggered?portalAt(props.scene,position):undefined;
      if(exit){gateTriggered=true;keys.clear();target=null;route=[];state.onTravel(exit.to);}
      renderTime=time;
      renderer.shadowMap.needsUpdate=!small&&shadows.take(time,frames.recent(time));
      if(renderer.shadowMap.needsUpdate)shadowUpdates++;
      renderer.info.autoReset=false;renderer.info.reset();if(composer)composer.render();else renderer.render(scene,camera);
      el.dataset.renderedFrames=String(++renderedFrames);el.dataset.shadowUpdates=String(shadowUpdates);el.dataset.reflectionUpdates=String(reflectionUpdates);
      const points=props.scene==='temple'?SANCTUARY_PLACES:portalsFor(props.scene);
      const placed:{x:number;y:number;w:number;h:number}[]=[];
      for(const point of [...points,...(hasBuilder?[{...BUILDER,id:'builder'}]:[])]){
        const button=markers.current.get(point.id);if(!button)continue;
        const w=toWorld(point);head.set(w.x,'to' in point?4.3:point.id==='builder'?3.15:2.25,w.z).project(camera);
        // A return arch behind the pilgrim can sit between the orbit camera and
        // body. Don't float its label over the destination's title on arrival.
        const aheadOfPlayer=-(w.x-focus.x)*Math.sin(yaw)-(w.z-focus.z)*Math.cos(yaw)>-1;
        const visible=state.active&&head.z>-1&&head.z<1&&Math.abs(head.x)<.94&&Math.abs(head.y)<.9&&(!('to' in point)||(aheadOfPlayer&&Math.hypot(focus.x-w.x,focus.z-w.z)<18));
        button.style.visibility=visible?'visible':'hidden';
        if(visible){
          let dimensions=markerSizes.get(button);
          if(!dimensions){dimensions={w:button.offsetWidth,h:button.offsetHeight};markerSizes.set(button,dimensions);}
          const {w,h}=dimensions;
          const x=T.MathUtils.clamp((head.x+1)*size.w/2-w/2,8,Math.max(8,size.w-w-8));let y=(1-head.y)*size.h/2-h;
          for(const other of placed)if(x<other.x+other.w+6&&x+w>other.x-6&&y<other.y+other.h+6&&y+h>other.y-6)y=other.y+other.h+6;
          placed.push({x,y,w,h});button.style.transform=`translate(${x}px,${y}px)`;
        }
      }
      const area=props.scene==='plaza'&&position?visitAreaAt(position):undefined;
      el.dataset.area=area?.id??props.scene;el.dataset.movementMode=state.running?'run':'walk';
      if(doorHint.current&&door){
        head.copy(door.anchor).project(camera);
        const aheadOfPlayer=-(door.root.position.x-focus.x)*Math.sin(yaw)-(door.root.position.z-focus.z)*Math.cos(yaw)>0;
        const visible=state.active&&aheadOfPlayer&&head.z>-1&&head.z<1&&Math.abs(head.x)<.9&&Math.abs(head.y)<.9;
        doorHint.current.style.visibility=visible?'visible':'hidden';
        doorHint.current.style.transform=`translate(${(head.x+1)*size.w/2}px,${(1-head.y)*size.h/2}px) translate(-50%,-50%)`;
      }
      for(const [id,model] of figures){
        if(!bubbleElements.current.has(id))continue;
        head.copy(model.root.position);head.y+=model.bubbleHeight;
        const nearby=camera.position.distanceToSquared(head)<24*24;
        head.project(camera);
        const visible=model.root.visible&&nearby&&head.z>-1&&head.z<1&&Math.abs(head.x)<1&&Math.abs(head.y)<1;
        placeBubble(bubbleElements.current,id,(head.x+1)*size.w/2,(1-head.y)*size.h/2,visible,size.w);
      }
      el.dataset.drawCalls=String(renderer.info.render.calls);el.dataset.triangles=String(renderer.info.render.triangles);
      el.dataset.cameraYaw=yaw.toFixed(3);
      el.dataset.playerNameplates=String([...figures].filter(([id,model])=>id!=='builder'&&model.nameVisible).length);
      el.dataset.npcNameplates=String(Number(figures.get('builder')?.nameVisible??false));
      el.dataset.selfElevation=(figures.get(state.self)?.root.position.y??0).toFixed(3);
      el.dataset.selfPosture=me?.posture??'standing';
      el.dataset.selfKneeling=(figures.get(state.self)?.poseAmount??0).toFixed(2);
      el.dataset.kneelingPlayers=String([...figures.values()].filter(model=>model.poseAmount>.9).length);
      if(!ready){ready=true;setState('ready');}
      const presentable=Boolean(me&&selfModel?.root.visible);
      if(presentable!==reportedReady){reportedReady=presentable;current.current.onPresentationReady?.(presentable);}
      frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    addEventListener('keydown',keyboard);addEventListener('keyup',keyup);addEventListener('blur',blur);
    document.addEventListener('visibilitychange',visibility);
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',pointerMove);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',blur);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('webglcontextlost',contextLost);
    return()=>{
      disposed=true;cancelAnimationFrame(frame);markerObserver.disconnect();reset.current=()=>{};walkToDoor.current=()=>{};walkToPoint.current=()=>{};
      current.current.onPresentationReady?.(false);
      removeEventListener('keydown',keyboard);removeEventListener('keyup',keyup);removeEventListener('blur',blur);
      document.removeEventListener('visibilitychange',visibility);
      el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',pointerMove);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',blur);el.removeEventListener('wheel',wheel);el.removeEventListener('webglcontextlost',contextLost);
      architecture.reflection?.getRenderTarget().dispose();sun.shadow.map?.dispose();disposeTree(scene);env?.dispose();bloom?.dispose();output?.dispose();composer?.dispose();renderer.dispose();
    };
  },[props.scene,props.quality]);
  return <div className="world-stage world-3d" data-renderer="three-webgl" data-feedback-phase={props.ritualLightCue?.startedAt===null?'waiting':props.ritualLightCue?'presented':'idle'} data-camera-view={firstPerson?'first':'third'} data-art-state={state} data-sprite-state={state}>
    <canvas ref={canvas} tabIndex={0} className="world-canvas" aria-label="3D world. WASD or arrow keys to walk. Drag to look around, scroll to zoom, or tap the floor to move."/>
    <SpeechBubbles bubbles={props.bubbles} elements={bubbleElements.current}/>
    <div className="world-place-markers">
      {(props.scene==='temple'?SANCTUARY_PLACES:[]).map(place=><button key={place.id} ref={el=>{if(el)markers.current.set(place.id,el);else markers.current.delete(place.id);}} className="world-place-marker" aria-label={`Open ${place.name.toLowerCase()} place`} onClick={()=>props.onRitual(place.id)}><span>{place.name}</span><small>{place.object}</small></button>)}
      {portalsFor(props.scene).map(portal=><button key={portal.id} ref={el=>{if(el)markers.current.set(portal.id,el);else markers.current.delete(portal.id);}} className="world-place-marker map-portal-marker" aria-label={`Walk through to ${SCENE_INFO[portal.to].name}`} onClick={()=>walkToPoint.current(portal)}><span>{SCENE_INFO[portal.to].name}</span><small>Another map ↗</small></button>)}
      {!isScenic(props.scene)&&<button ref={el=>{if(el)markers.current.set('builder',el);else markers.current.delete('builder');}} className="world-place-marker builder-marker" aria-label="Listen to the Builder" onClick={props.onGuide}><span>Listen</span></button>}
    </div>
    <div className="world-directory"><button disabled={!props.active} aria-expanded={placesOpen} onClick={()=>{setStreetOpen(false);setPlacesOpen(v=>!v);}}>{props.scene==='temple'?'Places to reflect':'Other maps'}</button>
      {props.scene==='market'&&<button disabled={!props.active} aria-expanded={streetOpen} onClick={()=>{setPlacesOpen(false);setStreetOpen(v=>!v);}}>Explore street</button>}
      {placesOpen&&<section aria-label="World places"><p>{props.scene==='temple'?'Choose a place. Nothing is submitted automatically.':'Walk through an arch to visit another map. These destinations are scenery only.'}</p>{props.scene==='temple'?SANCTUARY_PLACES.map(place=><button key={place.id} onClick={()=>{setPlacesOpen(false);props.onRitual(place.id);}}>{place.name}</button>):portalsFor(props.scene).map(portal=><button key={portal.id} onClick={()=>{setPlacesOpen(false);walkToPoint.current(portal);}}>{SCENE_INFO[portal.to].name}</button>)}{props.scene==='plaza'&&<button onClick={()=>{setPlacesOpen(false);walkToDoor.current();}}>Sanctuary doorway</button>}</section>}
      {streetOpen&&<section aria-label="Street directory"><p>Tap a door or a stall, or choose below. Interiors and trading are not open.</p>{STREET_FEATURES.map(feature=><button key={feature.id} onClick={()=>{setStreetOpen(false);props.onInspectStreet(feature.id);}}>{feature.title}<small>{feature.kind==='door'?'Closed doorway':'Display only'}</small></button>)}</section>}
    </div>
    {!isScenic(props.scene)&&<button ref={doorHint} className="sanctuary-door-hint" onClick={()=>walkToDoor.current()} aria-label={props.scene==='plaza'?'Walk to Sanctuary door':'Walk to garden door'}>{props.scene==='plaza'?'SANCTUARY':'GARDENS'}<span>Walk through the doorway</span></button>}
    <div className="view-controls"><button aria-label={firstPerson?'Switch to third-person view':'Switch to first-person view'} onClick={()=>setFirstPerson(v=>!v)}><Eye size={15}/>{firstPerson?'First person':'Third person'}</button><button aria-label="Reset camera view" onClick={()=>reset.current()}><RotateCcw size={14}/></button><NameVisibilityButton show={props.showPlayerNames} toggle={props.onTogglePlayerNames}/></div>
    {state!=='ready'&&<div className="art-loading" role="status">{state==='loading'?'Opening a world of light…':<span>This 3D preview needs WebGL 2 and hardware acceleration.<br/>Try refreshing or using a supported browser.<br/><a href="?view=2d">Open the previous 2D preview</a></span>}</div>}
  </div>;
}
