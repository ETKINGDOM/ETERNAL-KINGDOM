import {projectDataScope} from '../src/releaseScope';
import {releaseObjectName} from '../shared/releaseScope';
export {projectDataScope};
export const releaseObjectKey=(key:string)=>releaseObjectName(projectDataScope,key);
