(()=>{
const ASSET_BASE='https://bible-chronicles-v2.vercel.app/';
const objects=[
 {id:'semillas',name:'Semillas',x:96,y:320,r:52},
 {id:'canasta',name:'Canasta',x:225,y:705,r:82},
 {id:'cuenco',name:'Cuenco',x:708,y:744,r:70}
];
const state={found:new Set(),score:0,hints:2,sound:true};
const el=id=>document.getElementById(id);
const targetsEl=el('targets'),inventoryEl=el('inventory'),scoreEl=el('score'),starsEl=el('stars'),statusEl=el('status'),completeEl=el('complete');
let sceneRef=null,ambient=null,hintRing=null;

function render(){
 targetsEl.innerHTML=objects.map(o=>`<div class="target ${state.found.has(o.id)?'done':''}">${state.found.has(o.id)?'✓':'○'} ${o.name}</div>`).join('');
 const got=objects.filter(o=>state.found.has(o.id));
 inventoryEl.innerHTML=got.length?got.map(o=>`<span class="chip">${o.name}</span>`).join(''):'<span class="empty">Vacío</span>';
 scoreEl.textContent=state.score;
 const n=state.found.size;
 starsEl.textContent=n===0?'☆☆☆':n===1?'★☆☆':n===2?'★★☆':'★★★';
}
function say(t){statusEl.textContent=t}
function ping(){
 if(!state.sound)return;
 try{
   const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();
   o.frequency.value=880;g.gain.setValueAtTime(.12,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.18);
   o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.2);
 }catch(e){}
}
function foundObject(obj){
 if(state.found.has(obj.id))return;
 state.found.add(obj.id);state.score+=100;ping();render();say(obj.name+' encontrado. +100 puntos');
 if(hintRing){hintRing.destroy();hintRing=null}
 if(state.found.size===objects.length){
   state.score+=200;render();el('finalScore').textContent=state.score+' puntos';
   setTimeout(()=>{completeEl.hidden=false},500);
 }
}
class PrototypeScene extends Phaser.Scene{
 constructor(){super('prototype')}
 preload(){
  this.load.image('bg',ASSET_BASE+'assets/ui/Cain_Abel_Objetos.png');
  this.load.image('traveler',ASSET_BASE+'assets/characters/adrian-expedicion.png');
  this.load.audio('ambience',ASSET_BASE+'assets/audio/ambiente-cain-abel.mp3');
 }
 create(){
  sceneRef=this;
  const worldW=1536,worldH=864;
  this.cameras.main.setBounds(0,0,worldW,worldH);
  this.physics.world.setBounds(0,0,worldW,worldH);
  this.add.image(0,0,'bg').setOrigin(0).setDisplaySize(worldW,worldH);
  this.traveler=this.add.image(410,690,'traveler').setOrigin(.5,1).setScale(.28).setDepth(5);
  this.targetPos={x:this.traveler.x,y:this.traveler.y};

  this.objectZones=objects.map(o=>{
    const z=this.add.zone(o.x,o.y,o.r*2,o.r*2).setInteractive({useHandCursor:true});
    z.setData('obj',o);
    z.on('pointerup',()=>foundObject(o));
    return z;
  });

  this.input.on('pointerdown',p=>{
    if(p.rightButtonDown())return;
    this.dragStart={x:p.x,y:p.y,camX:this.cameras.main.scrollX,camY:this.cameras.main.scrollY,moved:false};
  });
  this.input.on('pointermove',p=>{
    if(!p.isDown||!this.dragStart)return;
    const dx=p.x-this.dragStart.x,dy=p.y-this.dragStart.y;
    if(Math.abs(dx)+Math.abs(dy)>12){
      this.dragStart.moved=true;
      const cam=this.cameras.main;
      cam.setScroll(this.dragStart.camX-dx/cam.zoom,this.dragStart.camY-dy/cam.zoom);
    }
  });
  this.input.on('pointerup',p=>{
    if(!this.dragStart)return;
    if(!this.dragStart.moved){
      const w=p.positionToCamera(this.cameras.main);
      if(!this.objectZones.some(z=>Phaser.Geom.Rectangle.Contains(z.getBounds(),w.x,w.y))){
        this.targetPos={x:Phaser.Math.Clamp(w.x,80,1450),y:Phaser.Math.Clamp(w.y,430,820)};
        say('El viajero se dirige al punto indicado.');
      }
    }
    this.dragStart=null;
  });

  this.input.on('wheel',(pointer,gos,dx,dy)=>{
    this.setZoom(this.cameras.main.zoom-(dy>0?.1:-.1));
  });
  ambient=this.sound.add('ambience',{loop:true,volume:.22});
  if(state.sound)ambient.play();
  this.setZoom(1);
 }
 setZoom(z){
  z=Phaser.Math.Clamp(z,.85,1.8);
  this.cameras.main.setZoom(z);
  el('zoomReset').textContent=Math.round(z*100)+'%';
 }
 update(){
  if(!this.traveler||!this.targetPos)return;
  const dx=this.targetPos.x-this.traveler.x,dy=this.targetPos.y-this.traveler.y,d=Math.hypot(dx,dy);
  if(d>3){
    const speed=2.7;
    this.traveler.x+=dx/d*speed;this.traveler.y+=dy/d*speed;
    this.traveler.setFlipX(dx<0);
  }
 }
}
const config={type:Phaser.AUTO,parent:'game',backgroundColor:'#111',physics:{default:'arcade'},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:PrototypeScene};
new Phaser.Game(config);

el('zoomIn').addEventListener('click',()=>sceneRef&&sceneRef.setZoom(sceneRef.cameras.main.zoom+.15));
el('zoomOut').addEventListener('click',()=>sceneRef&&sceneRef.setZoom(sceneRef.cameras.main.zoom-.15));
el('zoomReset').addEventListener('click',()=>sceneRef&&sceneRef.setZoom(1));
el('hintBtn').addEventListener('click',()=>{
 if(!sceneRef)return;
 if(state.hints<=0){say('Ya utilizaste las dos pistas disponibles en esta prueba.');return}
 const pending=objects.filter(o=>!state.found.has(o.id));if(!pending.length)return;
 const o=pending[Math.floor(Math.random()*pending.length)];
 state.hints--;say('Pista: observa con atención la zona iluminada. Quedan '+state.hints+' pistas.');
 if(hintRing)hintRing.destroy();
 hintRing=sceneRef.add.circle(o.x,o.y,o.r+20).setStrokeStyle(8,0xffdf57,.95).setDepth(9);
 sceneRef.tweens.add({targets:hintRing,scale:1.28,alpha:.3,duration:550,yoyo:true,repeat:5,onComplete:()=>{if(hintRing){hintRing.destroy();hintRing=null}}});
});
el('soundBtn').addEventListener('click',()=>{
 state.sound=!state.sound;el('soundBtn').textContent=state.sound?'🔊 SONIDO':'🔇 SONIDO';
 if(ambient){if(state.sound&&!ambient.isPlaying)ambient.play();else if(!state.sound)ambient.stop()}
});
function reset(){
 state.found.clear();state.score=0;state.hints=2;completeEl.hidden=true;render();say('Prueba reiniciada. Encuentra los tres objetos.');
 if(sceneRef){sceneRef.traveler.setPosition(410,690);sceneRef.targetPos={x:410,y:690};sceneRef.setZoom(1);sceneRef.cameras.main.setScroll(0,0)}
}
el('resetBtn').addEventListener('click',reset);
el('playAgain').addEventListener('click',reset);
render();
})();