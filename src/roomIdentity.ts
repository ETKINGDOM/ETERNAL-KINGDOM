import {releaseHeaders} from './releaseScope';
import {z} from 'zod';
import type {RoomIdentityAdapter} from '../shared/roomIdentity';
const ticketSchema=z.object({ticket:z.string().regex(/^[0-9a-f]{64}$/),expiresAt:z.number().int().positive()}).strict();
export const hostedRoomIdentity:RoomIdentityAdapter={
  async ticket(admission,signal){
    const response=await fetch('/api/auth/room-ticket',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...releaseHeaders()},body:JSON.stringify(admission),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)});
    if(!response.ok)throw new Error('Room identity could not be confirmed. Sign out to explore as a guest, or verify your wallet again.');
    const ticket=ticketSchema.parse(await response.json());if(ticket.expiresAt<=Date.now())throw new Error('Room ticket expired. Reconnecting…');
    return ticket;
  },
};
