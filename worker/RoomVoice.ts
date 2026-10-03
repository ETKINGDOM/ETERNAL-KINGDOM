import {VOICE_INVITE_TTL,VOICE_LEASE,type VoiceConsent,type VoiceClientPacket,type VoiceServerPacket} from '../shared/voice';
export type VoiceConnection={id:string;personId?:string;active:boolean;voice?:VoiceConsent;lastVoiceInvite?:number};
export interface RoomVoicePorts {
  connections():string[];read(id:string):VoiceConnection|undefined;write(connection:VoiceConnection):void;
  send(id:string,packet:VoiceServerPacket):void;
  allowed(actor:string,peer:string):Promise<boolean>;
}
// Consent metadata lives in hibernation attachments. SDP is forwarded to exactly
// one accepted participant; never stored, logged, replayed or broadcast.
export class RoomVoice {
  constructor(private ports:RoomVoicePorts,private now=()=>Date.now()){}
  private current(id:string){const c=this.ports.read(id);return c?.active?c:undefined;}
  private notify(c:VoiceConnection,ended=false){
    const v=c.voice;if(!v)return;
    this.ports.send(c.id,{v:1,type:'voice-state',callId:v.id,peer:v.peer,phase:ended?'ended':v.phase,initiator:v.initiator,peerReady:this.current(v.peer)?.voice?.ready??false});
  }
  end(id:string){
    const c=this.ports.read(id),v=c?.voice;if(!c||!v)return;
    const peer=this.ports.read(v.peer);
    this.notify(c,true);delete c.voice;this.ports.write(c);
    if(peer?.voice?.id===v.id){this.notify(peer,true);delete peer.voice;this.ports.write(peer);}
  }
  clean(){for(const id of this.ports.connections()){const c=this.ports.read(id);if(c?.voice&&c.voice.expiresAt<=this.now())this.end(id);}}
  expiries(){return this.ports.connections().flatMap(id=>{const v=this.ports.read(id)?.voice;return v?[v.expiresAt]:[];});}
  async handle(id:string,packet:VoiceClientPacket){
    this.clean();let actor=this.current(id);
    if(!actor?.personId){this.ports.send(id,{v:1,type:'voice-error',message:'Verify an EVM or Solana wallet before inviting someone to voice.'});return;}
    if(packet.type==='voice-control'&&packet.action==='leave'){
      if(actor.voice?.id===packet.callId)this.end(id);return;
    }
    const peerId=packet.type==='voice-invite'?packet.peer:actor.voice?.peer;
    let peer=peerId?this.current(peerId):undefined;
    const actorPerson=actor.personId,peerPerson=peer?.personId;
    if(!peerPerson||actorPerson===peerPerson||id===peerId){this.end(id);this.ports.send(id,{v:1,type:'voice-error',message:'Meet another verified person in this room before inviting them.'});return;}
    const before=actor.voice?.id;
    let allowed=false;try{allowed=await this.ports.allowed(id,peer!.id);}catch{/* Fail closed without request/identity/SDP logging. */}
    // Auth/block lookups yield. A departure, cancellation, concurrent invitation
    // or scope change must not resurrect the earlier consent decision.
    actor=this.current(id);peer=this.current(peerId!);
    if(!actor||!peer||actor.personId!==actorPerson||peer.personId!==peerPerson||actor.voice?.id!==before)return;
    if(!allowed){this.end(id);this.ports.send(id,{v:1,type:'voice-error',message:'Voice permission is unavailable or this private contact is blocked.'});return;}
    if(packet.type==='voice-invite'){
      if(actor.voice||peer.voice){this.ports.send(id,{v:1,type:'voice-error',message:'One person already has an invitation or call. Leave it before starting another.'});return;}
      if(actor.lastVoiceInvite&&this.now()-actor.lastVoiceInvite<20_000){this.ports.send(id,{v:1,type:'voice-error',message:'Please pause before sending another voice invitation.'});return;}
      const callId=crypto.randomUUID(),expiresAt=this.now()+VOICE_INVITE_TTL;
      actor.lastVoiceInvite=this.now();actor.voice={id:callId,peer:peer.id,phase:'outgoing',initiator:true,ready:false,expiresAt};
      peer.voice={id:callId,peer:id,phase:'incoming',initiator:false,ready:false,expiresAt};
      this.ports.write(actor);this.ports.write(peer);this.notify(actor);this.notify(peer);return;
    }
    const v=actor.voice,p=peer.voice;
    if(!v||!p||v.id!==packet.callId||p.id!==v.id||p.peer!==id||v.peer!==peer.id)return;
    if(v.expiresAt<=this.now()||p.expiresAt<=this.now()){this.end(id);return;}
    if(packet.type==='voice-control'){
      if(packet.action==='accept'){
        if(v.phase!=='incoming'||p.phase!=='outgoing')return;
        v.phase=p.phase='accepted';v.expiresAt=p.expiresAt=this.now()+VOICE_LEASE;
      }else{
        if(v.phase!=='accepted'||p.phase!=='accepted')return;
        if(packet.action==='ready')v.ready=true;
        // Each side must independently renew. One peer cannot keep another
        // silently recording after its signaling/permission connection is lost.
        v.expiresAt=this.now()+VOICE_LEASE;
      }
      this.ports.write(actor);this.ports.write(peer);this.notify(actor);this.notify(peer);return;
    }
    if(v.phase!=='accepted'||p.phase!=='accepted'||!v.ready||!p.ready)return;
    if(packet.description.type==='offer'?!v.initiator:v.initiator)return;
    this.ports.send(peer.id,{v:1,type:'voice-received',callId:v.id,description:packet.description});
  }
}
