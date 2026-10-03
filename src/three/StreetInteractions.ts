import * as T from 'three';
import type { Scene } from '../../shared/scenes';
import { STREET_FEATURES, type StreetFeature } from '../../shared/market';

// Invisible pick volumes are independent of the merged visual meshes. They add
// no draw calls and are disposed with the scene. Inspection never submits data.
export function createStreetInteractions(scene:T.Scene,kind:Scene){
  const targets:T.Mesh[]=[];
  if(kind==='market'){
    const material=new T.MeshBasicMaterial();
    for(const feature of STREET_FEATURES){
      const door=feature.kind==='door';
      const mesh=new T.Mesh(new T.BoxGeometry(door ? .12 : 2.9,door?3.3:1.8,door?2.2:2.1),material);
      mesh.position.set(feature.x-(door?Math.sign(feature.x)*.16:0),door?1.65:.9,feature.z);
      mesh.visible=false;mesh.userData.streetFeatureId=feature.id;scene.add(mesh);targets.push(mesh);
    }
  }
  return {targets,hit(raycaster:T.Raycaster):StreetFeature|undefined{
    const hit=raycaster.intersectObjects(targets,false)[0];if(!hit)return;
    // Do not inspect a door through the back of its house, or through a person.
    const occluders:T.Mesh[]=[];scene.traverseVisible(object=>{if(object instanceof T.Mesh)occluders.push(object);});
    const nearest=raycaster.intersectObjects(occluders,false)[0];
    if(nearest&&nearest.distance<hit.distance-.12)return;
    return STREET_FEATURES.find(feature=>feature.id===hit.object.userData.streetFeatureId);
  }};
}
