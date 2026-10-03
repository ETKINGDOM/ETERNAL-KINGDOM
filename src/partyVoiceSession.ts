import {PARTY_LEASE,type CommunityClient,type CommunityServer,type PartyInvitation,type PartyView} from '../shared/community';
import {browserVoiceMedia,type VoiceMediaPorts} from './voiceSession';
export type PartyVoiceSnapshot={self:string;party:PartyView|null;invitations:PartyInvitation[];outgoing:{id:string;peer:{personId:string;name:string;family:'evm'|'solana'}}[];microphone:'off'|'requesting'|'on';muted:boolean;connected:string[];error:string;playbackBlocked:boolean};
export const VOICE_AWAY_NOTICE='Voice stopped while the page was away.';
export const VOICE_NOTICE_DURATION=15_000;
type Edge={pc:RTCPeerConnection;audio?:HTMLAudioElement;sent:boolean;receiving:boolean;epoch:number};
const empty=():PartyVoiceSnapshot=>({self:'',party:null,invitations:[],outgoing:[],microphone:'off',muted:false,connected:[],error:'',playbackBlocked:false});
// At most three audio-only peers. Connectivity/SFU can be replaced without
// changing group consent. No media is uploaded to the Worker or persisted.
export class PartyVoiceSession{
  private state=empty();private listeners=new Set<()=>void>();private stream?:MediaStream;private edges=new Map<string,Edge>();private pendingEdges=new Map<string,Promise<Edge|undefined>>();
  private generation=0;private edgeEpoch=0;private lastState=0;private consent=false;private inviting=false;
  constructor(private send:(packet:CommunityClient)=>boolean,private media:VoiceMediaPorts=browserVoiceMedia,private now=()=>Date.now()){}
  getSnapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};available=()=>this.media.available();
  private patch(next:Partial<PartyVoiceSnapshot>){this.state={...this.state,...next};for(const fn of this.listeners)fn();}
  private closeEdges(){this.edgeEpoch++;for(const edge of this.edges.values()){edge.pc.ontrack=null;edge.pc.onconnectionstatechange=null;edge.pc.close();edge.audio?.pause();if(edge.audio)edge.audio.srcObject=null;}this.edges.clear();this.pendingEdges.clear();}
  private clean(){this.generation++;this.closeEdges();this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=undefined;this.consent=false;this.inviting=false;}
  reset(){this.clean();this.patch(empty());}
  leave(error=''){const id=this.state.party?.id;this.clean();this.patch({...empty(),self:this.state.self,error});if(id)this.send({v:1,type:'party-control',partyId:id,action:'leave'});}
  away(){
    const speaking=this.state.microphone!=='off'||Boolean(this.stream)||this.state.connected.length>0;
    if(!speaking&&!this.state.party&&!this.state.invitations.length&&!this.state.outgoing.length&&!this.inviting&&!this.consent)return;
    // Pending invitations still end on departure, but an idle visitor has no
    // interrupted call to report. Duplicate lifecycle events are harmless.
    this.leave(speaking?VOICE_AWAY_NOTICE:'');
  }
  invite(peer:string){if(this.inviting||!this.available())return;this.inviting=true;this.consent=true;this.patch({error:''});if(!this.send({v:1,type:'party-invite',peer})){this.inviting=false;this.consent=false;this.patch({error:'Voice connection unavailable. Try again when connected.'});}}
  answer(id:string,accept:boolean){if(accept)this.consent=true;if(!this.send({v:1,type:'party-answer',invitationId:id,accept})){this.consent=false;this.patch({error:'Voice connection unavailable.'});}}
  receive(packet:CommunityServer){
    if(packet.type==='community-ready'){this.patch({self:packet.self.personId});return;}
    if(packet.type==='community-error'){this.inviting=false;this.consent=false;this.patch({error:packet.message});return;}
    if(packet.type==='party-state'){
      const previous=this.state.party,next=packet.party;
      if(previous&&previous.id!==next?.id){this.clean();this.patch({microphone:'off',muted:false,connected:[],playbackBlocked:false});}
      else if(previous&&previous.revision!==next?.revision){this.closeEdges();this.patch({connected:[]});}
      this.inviting=false;this.lastState=this.now();this.patch({party:next,invitations:packet.invitations,outgoing:packet.outgoing});
      if(!next)return;
      if(next.members.length<2&&(this.stream||this.state.microphone==='requesting')){this.clean();this.patch({microphone:'off',muted:false,connected:[],playbackBlocked:false});return;}
      if(this.consent&&next.members.length>1&&this.state.microphone==='off'){this.consent=false;void this.enableMicrophone();}
      else if(this.stream)void this.reconcile();return;
    }
    if(packet.type==='party-received'){
      const p=this.state.party;if(!p||p.id!==packet.partyId||p.revision!==packet.revision||!this.stream)return;
      const peer=p.members.find(m=>m.personId===packet.peer);if(!peer?.ready||(packet.description.type==='offer'?this.state.self<packet.peer:this.state.self>packet.peer))return;
      void this.description(packet.peer,packet.description);return;
    }
  }
  tick(){const party=this.state.party;if(!party)return;if(this.now()-this.lastState>PARTY_LEASE||party.expiresAt<=this.now()){this.leave('Voice permission expired. Your microphone is off.');return;}
    if(!this.send({v:1,type:'party-control',partyId:party.id,action:'heartbeat'}))this.leave('Voice connection interrupted. Your microphone is off.');}
  async enableMicrophone(){
    const p=this.state.party;if(!p||this.state.microphone!=='off'||p.members.length<2)return;
    const epoch=this.generation;this.patch({microphone:'requesting',error:''});
    try{const stream=await this.media.microphone();if(epoch!==this.generation||this.state.party?.id!==p.id){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
      for(const t of stream.getAudioTracks())t.onended=()=>{if(epoch===this.generation)this.leave('Microphone stopped.');};
      this.patch({microphone:'on'});if(!this.send({v:1,type:'party-control',partyId:p.id,action:'ready'}))this.leave('Voice permission connection unavailable.');
    }catch{if(epoch===this.generation)this.leave('Microphone permission unavailable. Text chat is still available.');}
  }
  private async edge(peer:string):Promise<Edge|undefined>{
    const old=this.edges.get(peer);if(old)return old;const pending=this.pendingEdges.get(peer);if(pending)return pending;
    const epoch=this.edgeEpoch,party=this.state.party,stream=this.stream;
    if(!party||!stream||!party.members.some(m=>m.personId===peer&&m.ready)||!party.members.some(m=>m.personId===this.state.self&&m.ready))return;
    const work=(async()=>{const ice=await this.media.connectivity.iceServers();if(epoch!==this.edgeEpoch||this.state.party?.id!==party.id||this.stream!==stream)return;
      const pc=this.media.peer(ice),edge:Edge={pc,sent:false,receiving:false,epoch};this.edges.set(peer,edge);for(const t of stream.getAudioTracks())pc.addTrack(t,stream);
      pc.ontrack=e=>{if(epoch!==this.edgeEpoch||e.track.kind!=='audio')return;const a=edge.audio??this.media.audio();edge.audio=a;a.srcObject=e.streams[0]??new MediaStream([e.track]);void a.play().catch(()=>{if(epoch===this.edgeEpoch)this.patch({playbackBlocked:true});});};
      pc.onconnectionstatechange=()=>{if(epoch!==this.edgeEpoch)return;if(pc.connectionState==='connected')this.patch({connected:[...new Set([...this.state.connected,peer])]});if(['failed','disconnected','closed'].includes(pc.connectionState))this.leave('Voice network connection unavailable. A configured relay may be needed.');};return edge;
    })();this.pendingEdges.set(peer,work);try{return await work;}finally{if(this.pendingEdges.get(peer)===work)this.pendingEdges.delete(peer);}
  }
  private async reconcile(){const p=this.state.party,epoch=this.edgeEpoch;if(!p||!this.stream)return;try{await Promise.all(p.members.filter(m=>m.ready&&m.personId!==this.state.self).map(async m=>{const e=await this.edge(m.personId);if(e&&this.state.self<m.personId&&!e.sent){e.sent=true;await e.pc.setLocalDescription(await e.pc.createOffer());await this.sendDescription(m.personId,e);}}));}catch{if(epoch===this.edgeEpoch)this.leave('Voice setup unavailable. No automatic microphone restart.');}}
  private async sendDescription(peer:string,edge:Edge){
    const pc=edge.pc;if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);pc.removeEventListener('signalingstatechange',changed);};const changed=()=>{if(edge.epoch!==this.edgeEpoch||pc.signalingState==='closed'){cleanup();reject(Error('Closed'));}else if(pc.iceGatheringState==='complete'){cleanup();resolve();}};const timer=setTimeout(()=>{cleanup();reject(Error('ICE unavailable'));},8000);pc.addEventListener('icegatheringstatechange',changed);pc.addEventListener('signalingstatechange',changed);changed();});
    const party=this.state.party,d=pc.localDescription;if(edge.epoch!==this.edgeEpoch||!party||!d||!['offer','answer'].includes(d.type))return;
    if(!this.send({v:1,type:'party-signal',partyId:party.id,revision:party.revision,peer,description:{type:d.type as 'offer'|'answer',sdp:d.sdp}}))this.leave('Voice setup connection interrupted.');
  }
  private async description(peer:string,description:RTCSessionDescriptionInit){
    const epoch=this.edgeEpoch;
    let edge:Edge|undefined;try{edge=await this.edge(peer);if(!edge||edge.receiving)return;edge.receiving=true;await edge.pc.setRemoteDescription(description);if(edge.epoch!==this.edgeEpoch)return;
      if(description.type==='offer'){edge.sent=true;await edge.pc.setLocalDescription(await edge.pc.createAnswer());await this.sendDescription(peer,edge);}
    }catch{if(epoch===this.edgeEpoch)this.leave('Voice setup failed. Your microphone is off.');}
  }
  mute(){const muted=!this.state.muted;this.stream?.getAudioTracks().forEach(t=>t.enabled=!muted);this.patch({muted});if(this.state.party)this.send({v:1,type:'party-control',partyId:this.state.party.id,action:'mute',muted});}
  dismissNotice(expected?:string){if(expected!==undefined&&this.state.error!==expected)return;this.patch({error:''});}
  async resumeAudio(){
    const epoch=this.edgeEpoch;
    try{await Promise.all([...this.edges.values()].map(e=>e.audio?.play()));if(epoch===this.edgeEpoch)this.patch({playbackBlocked:false});}
    catch{if(epoch===this.edgeEpoch)this.patch({playbackBlocked:true});}
  }
}
