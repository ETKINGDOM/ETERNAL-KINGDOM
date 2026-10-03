import {PARTY_LIMIT,PARTY_DURATION,PARTY_INVITE_TTL,PARTY_LEASE,type CommunityClient,type CommunityServer,type PartyMember} from '../shared/community';
import type {SocialPeer} from '../shared/social';
type Member=PartyMember&{connection:string;lease:number};
type Party={id:string;revision:number;expiresAt:number;members:Member[]};
type Invitation={id:string;partyId:string;from:SocialPeer;to:SocialPeer;expiresAt:number};
export type PartyState={parties:Party[];invitations:Invitation[]};
export type CommunityPerson=SocialPeer&{connection:string;color:string};
export interface CommunityVoicePorts{
  load():PartyState;save(state:PartyState,ephemeral?:boolean):void;person(connection:string):CommunityPerson|undefined;
  connections(personId:string):string[];send(connection:string,packet:CommunityServer):void;
  allowed(actor:string,peer:string):Promise<boolean>;allowInvite(connection:string):boolean;
}
const publicMember=({personId,name,family,color,ready,muted}:Member):PartyMember=>({personId,name,family,color,ready,muted});
// One serialized authority for group membership/capacity. Persist consent only;
// SDP is forwarded directly to an accepted, ready member, never saved.
export class CommunityVoice{
  constructor(private p:CommunityVoicePorts,private now=()=>Date.now()){}
  snapshot(connection:string){
    const state=this.p.load(),actor=this.p.person(connection);if(!actor)return;
    const party=state.parties.find(g=>g.members.some(m=>m.connection===connection));
    this.p.send(connection,{v:1,type:'party-state',party:party?{id:party.id,revision:party.revision,expiresAt:party.expiresAt,members:party.members.map(publicMember)}:null,
      invitations:state.invitations.filter(i=>i.to.personId===actor.personId).slice(0,8).flatMap(i=>{const g=state.parties.find(g=>g.id===i.partyId);return g?[{id:i.id,partyId:i.partyId,from:i.from,expiresAt:i.expiresAt,members:g.members.map(publicMember)}]:[];}),
      outgoing:party?state.invitations.filter(i=>i.partyId===party.id&&i.from.personId===actor.personId).map(i=>({id:i.id,peer:i.to})):[]});
  }
  private notify(state:PartyState,extra?:string[]){
    const ids=new Set(extra??[...state.parties.flatMap(g=>g.members.map(m=>m.personId)),...state.invitations.flatMap(i=>[i.to.personId,i.from.personId])]);
    for(const id of ids)for(const connection of this.p.connections(id))this.snapshot(connection);
  }
  clean(disconnected?:string){
    const s=this.p.load(),before=JSON.stringify(s),affected=s.parties.flatMap(g=>g.members.map(m=>m.personId)).concat(s.invitations.flatMap(i=>[i.to.personId,i.from.personId]));
    for(const g of s.parties){const old=g.members.length;g.members=g.expiresAt<=this.now()?[]:g.members.filter(m=>m.connection!==disconnected&&m.lease>this.now()&&this.p.person(m.connection));if(old!==g.members.length){g.revision++;if(g.members.length===1){g.members[0].ready=false;g.members[0].muted=false;}}}
    s.parties=s.parties.filter(g=>g.members.length);s.invitations=s.invitations.filter(i=>i.expiresAt>this.now()&&s.parties.some(g=>g.id===i.partyId&&g.members.some(m=>m.personId===i.from.personId))&&this.p.connections(i.to.personId).length);
    if(JSON.stringify(s)!==before){this.p.save(s);this.notify(s,affected);}
  }
  deadlines(){const s=this.p.load();return [...s.parties.flatMap(g=>[g.expiresAt,...g.members.map(m=>m.lease)]),...s.invitations.map(i=>i.expiresAt)];}
  async handle(connection:string,packet:CommunityClient){
    this.clean();const actor=this.p.person(connection);if(!actor)return;
    const error=(message:string)=>this.p.send(connection,{v:1,type:'community-error',message});
    if(packet.type==='community-ping'||packet.type==='community-watch')return;
    let state=this.p.load(),party=state.parties.find(g=>g.members.some(m=>m.personId===actor.personId));
    if(party&&!party.members.some(m=>m.connection===connection)){error('Your voice party is open in another browser tab.');return;}
    if(packet.type==='party-control'&&packet.action==='leave'){
      if(party?.id===packet.partyId){this.clean(connection);this.snapshot(connection);}return;
    }
    const invitation=packet.type==='party-answer'?state.invitations.find(i=>i.id===packet.invitationId&&i.to.personId===actor.personId):undefined;
    const peer=packet.type==='party-invite'?this.p.connections(packet.peer).map(c=>this.p.person(c)).find(Boolean):undefined;
    const targetGroup=invitation?state.parties.find(g=>g.id===invitation.partyId):party;
    const checkIds=packet.type==='party-invite'?(peer?[peer.personId,...(party?.members.map(m=>m.personId)??[])]:[]):targetGroup?.members.map(m=>m.personId).filter(id=>id!==actor.personId)??[];
    if(packet.type==='party-answer'&&!packet.accept){if(invitation){state.invitations=state.invitations.filter(i=>i.id!==invitation.id);this.p.save(state);this.notify(state,[actor.personId,invitation.from.personId]);}return;}
    const check=async(ids:string[])=>Promise.all([...new Set(ids)].filter(id=>id!==actor.personId).map(async id=>{try{return await this.p.allowed(actor.personId,id);}catch{return false;}}));
    const allowed=await check(checkIds);
    // Simultaneous acceptances can add another audience while checks yield.
    // Check newly admitted members internally, instead of requiring an extra
    // user click; the fixed four-person bound also bounds this catch-up loop.
    if(packet.type==='party-answer'&&packet.accept)for(let i=0;i<PARTY_LIMIT;i++){
      const latest=this.p.load(),invite=latest.invitations.find(v=>v.id===packet.invitationId&&v.to.personId===actor.personId),g=latest.parties.find(g=>g.id===invite?.partyId);
      const more=g?.members.filter(m=>m.personId!==actor.personId&&!checkIds.includes(m.personId)).map(m=>m.personId)??[];
      if(!more.length)break;allowed.push(...await check(more));checkIds.push(...more);
    }
    if(!this.p.person(connection)||this.p.person(connection)?.personId!==actor.personId)return;
    this.clean();state=this.p.load();party=state.parties.find(g=>g.members.some(m=>m.connection===connection));
    if(state.parties.some(g=>g.members.some(m=>m.personId===actor.personId&&m.connection!==connection))){error('Your voice party is open in another browser tab.');return;}
    if(allowed.some(v=>!v)){if(party)this.clean(connection);error('Voice permission is unavailable or a contact is blocked.');return;}
    if(packet.type==='party-invite'){
      if(!peer||peer.personId===actor.personId||!this.p.connections(peer.personId).length){error('This person is offline.');return;}
      if(state.parties.some(g=>g.members.some(m=>m.personId===peer.personId))||state.invitations.some(i=>i.to.personId===peer.personId)){error('This person already has a party or invitation.');return;}
      if(!this.p.allowInvite(connection)){error('Please pause before another voice invitation.');return;}
      if(!party){if(state.parties.length>=24){error('Voice capacity is full. Please try later.');return;}party={id:crypto.randomUUID(),revision:0,expiresAt:this.now()+PARTY_DURATION,members:[{...actor,ready:false,muted:false,lease:this.now()+PARTY_INVITE_TTL}]};state.parties.push(party);}
      if(party.members.length+state.invitations.filter(i=>i.partyId===party!.id).length>=PARTY_LIMIT){error('A voice party has room for four people.');return;}
      const expiresAt=Math.min(this.now()+PARTY_INVITE_TTL,party.expiresAt);
      state.invitations.push({id:crypto.randomUUID(),partyId:party.id,from:{personId:actor.personId,name:actor.name,family:actor.family},to:{personId:peer.personId,name:peer.name,family:peer.family},expiresAt});
      this.p.save(state);this.notify(state,[...party.members.map(m=>m.personId),peer.personId]);return;
    }
    if(packet.type==='party-answer'){
      const invite=state.invitations.find(i=>i.id===packet.invitationId&&i.to.personId===actor.personId),g=state.parties.find(g=>g.id===invite?.partyId);
      if(!invite||!g||party||g.members.length>=PARTY_LIMIT||state.parties.some(g=>g.members.some(m=>m.personId===actor.personId))){error('This voice invitation is no longer available.');return;}
      // Membership may have changed while authorization yielded: do not admit
      // against an audience that was not checked. The user may explicitly retry.
      if(g.members.some(m=>!checkIds.includes(m.personId))){error('The party changed. Try accepting again.');return;}
      g.members.push({...actor,ready:false,muted:false,lease:this.now()+PARTY_LEASE});g.revision++;state.invitations=state.invitations.filter(i=>i.id!==invite.id);
      this.p.save(state);this.notify(state,g.members.map(m=>m.personId));return;
    }
    if(!party||party.id!==packet.partyId)return;
    if(party.members.some(m=>m.personId!==actor.personId&&!checkIds.includes(m.personId)))return;
    const member=party.members.find(m=>m.connection===connection)!;
    if(packet.type==='party-control'){
      const latest=this.p.person(connection),profileChanged=Boolean(latest&&(member.name!==latest.name||member.color!==latest.color));if(latest){member.name=latest.name;member.color=latest.color;}
      if(packet.action==='ready')member.ready=true;
      if(packet.action==='mute')member.muted=packet.muted??true;
      member.lease=this.now()+(party.members.length<2?PARTY_INVITE_TTL:PARTY_LEASE);
      this.p.save(state,packet.action==='heartbeat'&&!profileChanged);this.notify(state,party.members.map(m=>m.personId));return;
    }
    if(packet.type==='party-signal'){
      const target=party.members.find(m=>m.personId===packet.peer);
      if(party.revision!==packet.revision||!member.ready||!target?.ready||target.connection===connection||!this.p.person(target.connection))return;
      if(packet.description.type==='offer'?actor.personId>target.personId:actor.personId<target.personId)return;
      this.p.send(target.connection,{v:1,type:'party-received',partyId:party.id,revision:party.revision,peer:actor.personId,description:packet.description});
    }
  }
}
