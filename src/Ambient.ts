// Original instrumental atmosphere: slow pads, sparse bells, no external samples/API.
export class Ambient {
  private ctx: AudioContext;
  private master: GainNode;
  private input: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopping: Promise<void> | null = null;
  private nextChord=0;
  private nextBell=0;
  private chord=0;
  private bell=0;
  private volume=.38;
  private ducked=false;
  private oscillators=new Set<OscillatorNode>();
  private readonly chords=[
    [146.832,220,293.665,329.628],
    [130.813,196,261.626,329.628],
    [146.832,220,293.665,369.994],
    [164.814,220,329.628,440],
  ];
  constructor(){
    this.ctx=new AudioContext();const ctx=this.ctx;
    this.master=ctx.createGain();this.master.gain.value=0;
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=15;limiter.ratio.value=5;limiter.attack.value=.03;limiter.release.value=.5;
    this.master.connect(limiter);limiter.connect(ctx.destination);
    this.input=ctx.createGain();
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2600;filter.Q.value=.25;this.input.connect(filter);
    const dry=ctx.createGain();dry.gain.value=.65;filter.connect(dry);dry.connect(this.master);
    const reverb=ctx.createConvolver();const impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*6),ctx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const a=impulse.getChannelData(channel);let smooth=0;
      for(let i=0;i<a.length;i++){smooth=smooth*.65+(Math.random()*2-1)*.35;a[i]=smooth*Math.exp(-i/ctx.sampleRate*.95);}
    }
    reverb.buffer=impulse;filter.connect(reverb);const wet=ctx.createGain();wet.gain.value=.56;reverb.connect(wet);wet.connect(this.master);
  }
  private tone(hz:number,start:number,duration:number,level:number,attack:number,pan:number,detune=0){
    const ctx=this.ctx,osc=ctx.createOscillator(),gain=ctx.createGain(),stereo=ctx.createStereoPanner();
    osc.type='sine';osc.frequency.value=hz;osc.detune.value=detune;stereo.pan.value=pan;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+attack);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(stereo);stereo.connect(this.input);this.oscillators.add(osc);
    osc.onended=()=>{osc.disconnect();gain.disconnect();stereo.disconnect();this.oscillators.delete(osc);};osc.start(start);osc.stop(start+duration+.1);
  }
  private schedule(){
    if(this.stopping||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    if(this.nextChord<now)this.nextChord=now+.05;
    if(this.nextBell<now)this.nextBell=now+.2;
    if(this.nextChord<now+.6){
      this.chords[this.chord++%this.chords.length].forEach((hz,i)=>{
        const pan=(i-1.5)*.27;
        this.tone(hz,this.nextChord,23,.064,4,pan,-3);
        this.tone(hz*2,this.nextChord,22,.009,5,-pan,3);
      });
      this.nextChord+=17;
    }
    if(this.nextBell<now+.6){
      const melody=[587.33,0,739.989,880,0,659.255,587.33,493.883,0,440,659.255,0];
      const note=melody[this.bell++%melody.length];
      if(note){const pan=Math.sin(this.bell*1.7)*.35;this.tone(note,this.nextBell,6,.07,.045,pan);this.tone(note*2.001,this.nextBell,3,.012,.02,pan);}
      this.nextBell+=4.6;
    }
  }
  async start(){
    await this.ctx.resume();if(this.stopping)return;
    this.nextChord=this.ctx.currentTime+.05;this.nextBell=this.ctx.currentTime+1;
    this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,1.4);
    this.schedule();this.timer=setInterval(()=>this.schedule(),250);
  }
  setVolume(value:number){this.volume=Math.max(0,Math.min(.8,value));this.updateGain();}
  setDucked(ducked:boolean){this.ducked=ducked;this.updateGain();}
  private updateGain(){if(this.ctx.state!=='closed'&&!this.stopping)this.master.gain.setTargetAtTime(this.volume*(this.ducked?.22:1),this.ctx.currentTime,.45);}
  stop(){
    if(this.stopping)return this.stopping;
    if(this.timer)clearInterval(this.timer);
    this.stopping=(async()=>{
      if(this.ctx.state==='closed')return;
      this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.08);
      await new Promise(resolve=>setTimeout(resolve,300));
      for(const osc of this.oscillators){try{osc.stop();}catch{/* Already ended. */}}
      await this.ctx.close();
    })();
    return this.stopping;
  }
}
