import { useEffect, useRef, useState } from 'react';
import { serverPacketSchema, type ChatMessage, type ClientPacket, type Player } from '../shared/protocol';
import { CHAT_TTL, COLORS, type Scene } from '../shared/world';
import { receiveSpeech, type SpeechBubble } from './speechBubbleState';
import type {WalletSession} from '../shared/identity';
import {ROOM_PROTOCOL} from '../shared/roomIdentity';
import {hostedRoomIdentity} from './roomIdentity';
import type {ReportReceipt} from '../shared/reporting';
import type {VoiceServerPacket} from '../shared/voice';

export type Profile = { name: string; color: typeof COLORS[number] };
export function useWorld(scene: Scene, channel: number, profile: Profile, enabled = true,session:WalletSession|null=null) {
  const identityScope=session?`${session.accountId}/${session.expiresAt}`:'guest';
  const currentScope=useRef(identityScope);currentScope.current=identityScope;
  const connectedScope=useRef('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const [self, setSelf] = useState('');
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [error, setError] = useState('');
  const [reportReceipt,setReportReceipt]=useState<ReportReceipt|null>(null),[reviewConfigured,setReviewConfigured]=useState(false),[mutedUntil,setMutedUntil]=useState(0);
  const socket = useRef<WebSocket | null>(null);
  const voiceListeners=useRef(new Set<(packet:VoiceServerPacket)=>void>());
  const subscribeVoice=(listener:(packet:VoiceServerPacket)=>void)=>{voiceListeners.current.add(listener);return()=>{voiceListeners.current.delete(listener);};};
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const send = (packet: ClientPacket) => {
    if (connectedScope.current!==currentScope.current||socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(packet));
    return true;
  };
  useEffect(() => {
    if (!enabled) { setStatus('offline'); setPlayers([]); setMessages([]); setBubbles([]); setSelf(''); return; }
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    let heartbeat: ReturnType<typeof setInterval>;
    let attempts = 0;
    let lastPacket = Date.now();
    const admission=new AbortController();
    async function connect() {
      if (disposed) return;
      setStatus('connecting'); setPlayers([]); setMessages([]); setBubbles([]); setSelf(''); setError('');
      setReportReceipt(null);setReviewConfigured(false);setMutedUntil(0);
      let protocols:string[]|undefined;
      if(session){
        try{
          const proof=await hostedRoomIdentity.ticket({accountId:session.accountId,sessionExpiresAt:session.expiresAt,scene,channel},admission.signal);
          protocols=[ROOM_PROTOCOL,`ticket.${proof.ticket}`];
        }catch(error){
          if(disposed)return;setStatus('offline');setError(error instanceof Error?error.message:'Room identity is unavailable.');
          retry=setTimeout(()=>void connect(),Math.min(3000*2**attempts++,30000));return;
        }
      }
      if(disposed||currentScope.current!==identityScope)return;
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${scene}/${channel}`,protocols);
      socket.current = ws;
      connectedScope.current=identityScope;
      ws.onmessage = event => {
        if (disposed || socket.current!==ws || typeof event.data !== 'string') return;
        let input: unknown;
        try { input = JSON.parse(event.data); } catch { return; }
        const result = serverPacketSchema.safeParse(input);
        if (!result.success) return;
        lastPacket = Date.now();
        const p = result.data;
        if(p.type==='voice-state'||p.type==='voice-received'||p.type==='voice-error'){for(const receive of voiceListeners.current)receive(p);return;}
        if (p.type === 'welcome') {
          attempts = 0; setStatus('online'); setSelf(p.self); setPlayers(p.players); setMessages(p.history);
          setReviewConfigured(p.reviewConfigured??false);setMutedUntil(p.mutedUntil??0);
          if(!session)ws.send(JSON.stringify({ v: 1, type: 'profile', ...profileRef.current }));
        } else if (p.type === 'player') setPlayers(old => [...old.filter(x => x.id !== p.player.id), p.player]);
        else if (p.type === 'left') {
          setPlayers(old => old.filter(x => x.id !== p.id));
          setBubbles(old => old.filter(x => x.sender !== p.id));
        } else if (p.type === 'chat') {
          setMessages(old => [...old, p.message].slice(-40));
          setBubbles(old => receiveSpeech(old, p.message, Date.now()));
        }
        else if(p.type==='chat-removed'){setMessages(old=>old.filter(m=>m.id!==p.id));setBubbles(old=>old.filter(b=>b.id!==p.id));}
        else if(p.type==='public-mute'){setMutedUntil(p.until);if(!p.until)setError('');}
        else if(p.type==='report-receipt'){setReportReceipt(p.receipt);setReviewConfigured(p.receipt.reviewConfigured);}
        else if (p.type === 'error') setError(p.message);
      };
      ws.onclose = () => {
        if(disposed||socket.current!==ws)return;
        clearInterval(heartbeat);
        setStatus('offline'); setPlayers([]); setBubbles([]); setSelf('');
        setError('Connection interrupted or room full. Reconnecting… You can try another channel.');
        retry = setTimeout(()=>void connect(), Math.min(1500 * 2 ** attempts++, 15000));
      };
      ws.onerror = () => { /* onclose controls retry; no duplicate connections. */ };
      heartbeat = setInterval(() => {
        if (Date.now() - lastPacket > 45000) { ws.close(); return; }
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ v: 1, type: 'ping' }));
      }, 15000);
    }
    void connect();
    return () => { disposed = true; admission.abort();clearTimeout(retry); clearInterval(heartbeat); socket.current?.close(); socket.current = null;connectedScope.current=''; };
  }, [scene, channel, enabled,identityScope]);
  useEffect(() => {
    if(!session){send({v:1,type:'profile',...profile});return;}
    // Coalesce closely spaced saves; the room reads the authoritative profile.
    const timer=setTimeout(()=>send({v:1,type:'refresh-profile'}),1100);return()=>clearTimeout(timer);
  }, [profile.name,profile.color,identityScope]);
  useEffect(() => {
    const expiry = setInterval(() => setMessages(old => old.filter(m => m.time > Date.now() - CHAT_TTL)), 1000);
    return () => clearInterval(expiry);
  }, []);
  useEffect(() => {
    if (!bubbles.length) return;
    const delay = Math.max(0, Math.min(...bubbles.map(b => b.expiresAt)) - Date.now());
    const expiry = setTimeout(() => setBubbles(old => old.filter(b => b.expiresAt > Date.now())), delay);
    return () => clearTimeout(expiry);
  }, [bubbles]);
  useEffect(()=>{if(!mutedUntil)return;const timer=setTimeout(()=>{setMutedUntil(0);setError('');},Math.max(0,mutedUntil-Date.now()));return()=>clearTimeout(timer);},[mutedUntil]);
  return { players, messages, bubbles, self, status, error, setError, send,subscribeVoice,reportReceipt,reviewConfigured,mutedUntil };
}
