import type {VoiceClientPacket,VoiceServerPacket} from '../shared/voice';
export type VoiceCall={id:string;peer:string;phase:'outgoing'|'incoming'|'accepted';initiator:boolean;peerReady:boolean};
export type VoiceSnapshot={call:VoiceCall|null;microphone:'off'|'requesting'|'on';connection:'idle'|'connecting'|'connected';muted:boolean;error:string;playbackBlocked:boolean};
export interface VoiceConnectivityAdapter {iceServers():Promise<RTCIceServer[]>}
export const directVoiceConnectivity:VoiceConnectivityAdapter={iceServers:async()=>[{urls:'stun:stun.cloudflare.com:3478'}]};
export interface VoiceMediaPorts {
  available():boolean;microphone():Promise<MediaStream>;peer(iceServers:RTCIceServer[]):RTCPeerConnection;
  audio():HTMLAudioElement;connectivity:VoiceConnectivityAdapter;
}
export const browserVoiceMedia:VoiceMediaPorts={available:()=>Boolean(globalThis.isSecureContext&&typeof navigator.mediaDevices?.getUserMedia==='function'&&typeof globalThis.RTCPeerConnection==='function'),
  microphone:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}),
  peer:iceServers=>new RTCPeerConnection({iceServers}),audio:()=>new Audio(),connectivity:directVoiceConnectivity};
const empty=():VoiceSnapshot=>({call:null,microphone:'off',connection:'idle',muted:false,error:'',playbackBlocked:false});
// App-owned, volatile and independent of dialog visibility. No recording,
// transcription, telemetry, faith composer or persistent browser storage.
export class VoiceSession {
  private state=empty();private listeners=new Set<()=>void>();private stream?:MediaStream;private pc?:RTCPeerConnection;private remote?:HTMLAudioElement;
  private generation=0;private lastPermission=0;private signalSent=false;private signalReceiving=false;
  private waitingInvite=false;private inviteAt=0;
  constructor(private send:(packet:VoiceClientPacket)=>boolean,private media:VoiceMediaPorts=browserVoiceMedia,private now=()=>Date.now()){}
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  available=()=>this.media.available();
  private patch(next:Partial<VoiceSnapshot>){this.state={...this.state,...next};for(const notify of this.listeners)notify();}
  private clean(){
    this.generation++;this.signalSent=false;this.signalReceiving=false;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=undefined;
    if(this.pc){this.pc.ontrack=null;this.pc.onconnectionstatechange=null;this.pc.close();this.pc=undefined;}
    if(this.remote){this.remote.pause();this.remote.srcObject=null;this.remote=undefined;}
  }
  reset(){this.clean();this.waitingInvite=false;this.patch(empty());}
  leave(error=''){
    const call=this.state.call;
    this.clean();this.waitingInvite=false;this.patch({...empty(),error});
    if(call)this.send({v:1,type:'voice-control',callId:call.id,action:'leave'});
  }
  invite(peer:string){
    if(this.state.call||this.waitingInvite)return;
    if(!this.available()){this.patch({error:'Live voice requires a supported HTTPS browser.'});return;}
    this.waitingInvite=true;this.inviteAt=this.now();this.patch({error:''});
    if(!this.send({v:1,type:'voice-invite',peer})){this.waitingInvite=false;this.patch({error:'Voice invitation was not sent. Wait for the room connection.'});}
  }
  accept(){const call=this.state.call;if(call?.phase==='incoming'&&!this.send({v:1,type:'voice-control',callId:call.id,action:'accept'}))this.leave('Room connection unavailable.');}
  tick(){
    if(this.waitingInvite&&this.now()-this.inviteAt>10_000){this.waitingInvite=false;this.patch({error:'Invitation response unavailable. No automatic retry.'});}
    const call=this.state.call;if(!call)return;
    if(this.now()-this.lastPermission>(call.phase==='accepted'?12_000:45_000)){this.leave('Voice permission or signaling expired. Invite again when connected.');return;}
    if(call.phase==='accepted'&&!this.send({v:1,type:'voice-control',callId:call.id,action:'heartbeat'}))this.leave('Room connection interrupted. Microphone stopped.');
  }
  receive(packet:VoiceServerPacket){
    if(packet.type==='voice-error'){this.waitingInvite=false;this.patch({error:packet.message});return;}
    if(packet.type==='voice-state'){
      if(packet.phase==='ended'){if(this.state.call?.id===packet.callId)this.leave('Voice ended. Your microphone is off.');return;}
      if(this.state.call&&this.state.call.id!==packet.callId)return;
      this.waitingInvite=false;this.lastPermission=this.now();
      this.patch({call:{id:packet.callId,peer:packet.peer,phase:packet.phase,initiator:packet.initiator,peerReady:packet.peerReady},error:''});
      if(packet.phase==='accepted'&&packet.initiator&&packet.peerReady&&this.stream&&!this.signalSent)void this.offer();
      return;
    }
    const call=this.state.call;
    if(!call||call.id!==packet.callId||call.phase!=='accepted'||!this.pc||!this.stream||!call.peerReady||this.signalReceiving)return;
    if(packet.description.type==='offer'?call.initiator:!call.initiator)return;
    this.signalReceiving=true;void this.description(packet.description);
  }
  async enableMicrophone(){
    const call=this.state.call;if(call?.phase!=='accepted'||this.state.microphone!=='off')return;
    const epoch=this.generation;this.patch({microphone:'requesting',error:''});
    try{
      // Only this explicit user action asks for microphone permission. Invitation,
      // friendship, text chat, acceptance and received SDP never call this.
      const stream=await this.media.microphone();
      if(epoch!==this.generation||this.state.call?.id!==call.id){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      const ice=await this.media.connectivity.iceServers();
      if(epoch!==this.generation||this.state.call?.id!==call.id){stream.getTracks().forEach(track=>track.stop());return;}
      const pc=this.media.peer(ice);this.pc=pc;
      for(const track of stream.getAudioTracks()){track.onended=()=>{if(epoch===this.generation)this.leave('Microphone stopped.');};pc.addTrack(track,stream);}
      pc.ontrack=event=>{
        if(epoch!==this.generation||event.track.kind!=='audio')return;
        const remote=this.remote??this.media.audio();this.remote=remote;
        remote.srcObject=event.streams[0]??new MediaStream([event.track]);
        void remote.play().catch(()=>{if(epoch===this.generation)this.patch({playbackBlocked:true});});
      };
      pc.onconnectionstatechange=()=>{
        if(epoch!==this.generation)return;
        if(pc.connectionState==='connected')this.patch({connection:'connected'});
        if(pc.connectionState==='failed'||pc.connectionState==='disconnected'||pc.connectionState==='closed')this.leave('Voice connection lost. Some networks require a configured TURN relay.');
      };
      this.patch({microphone:'on',connection:'connecting'});
      if(!this.send({v:1,type:'voice-control',callId:call.id,action:'ready'})){this.leave('Room connection unavailable.');return;}
      if(this.state.call?.initiator&&this.state.call.peerReady&&!this.signalSent)void this.offer();
    }catch{if(epoch===this.generation)this.leave('Microphone permission or voice setup unavailable. You can still use text chat.');}
  }
  private async gather(pc:RTCPeerConnection,epoch:number){
    if(pc.iceGatheringState==='complete')return;
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>{cleanup();reject(Error('ICE timeout'));},8_000);
      const changed=()=>{if(epoch!==this.generation||pc.signalingState==='closed'){cleanup();reject(Error('closed'));}else if(pc.iceGatheringState==='complete'){cleanup();resolve();}};
      const cleanup=()=>{clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',changed);pc.removeEventListener('signalingstatechange',changed);};
      pc.addEventListener('icegatheringstatechange',changed);pc.addEventListener('signalingstatechange',changed);changed();
    });
  }
  private async sendDescription(pc:RTCPeerConnection,epoch:number){
    await this.gather(pc,epoch);
    const call=this.state.call,d=pc.localDescription;
    if(epoch!==this.generation||!call||!d||!['offer','answer'].includes(d.type))return;
    if(!this.send({v:1,type:'voice-signal',callId:call.id,description:{type:d.type as 'offer'|'answer',sdp:d.sdp}}))this.leave('Voice setup was not sent.');
  }
  private async offer(){
    const pc=this.pc,epoch=this.generation;if(!pc||this.signalSent)return;this.signalSent=true;
    try{await pc.setLocalDescription(await pc.createOffer());await this.sendDescription(pc,epoch);}catch{if(epoch===this.generation)this.leave('Voice setup failed. No automatic reconnect or microphone restart.');}
  }
  private async description(description:RTCSessionDescriptionInit){
    const pc=this.pc,epoch=this.generation;if(!pc)return;
    try{
      await pc.setRemoteDescription(description);
      if(epoch!==this.generation)return;
      if(description.type==='offer'){this.signalSent=true;await pc.setLocalDescription(await pc.createAnswer());await this.sendDescription(pc,epoch);}
    }catch{if(epoch===this.generation)this.leave('Voice setup failed. No audio was recorded.');}
  }
  mute(){const muted=!this.state.muted;this.stream?.getAudioTracks().forEach(track=>track.enabled=!muted);this.patch({muted});}
  async resumeAudio(){
    const epoch=this.generation;
    try{await this.remote?.play();if(epoch===this.generation)this.patch({playbackBlocked:false});}
    catch{if(epoch===this.generation)this.patch({playbackBlocked:true});}
  }
}
