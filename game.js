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
 if(sceneRef)sceneRef.collectObject(obj);
 state.found.add(obj.id);state.score+=100;ping();render();say(obj.name+' recogido y guardado en el inventario. +100 puntos');
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
  this.load.image('clean',ASSET_BASE+'assets/ui/Cain_Abel_Limpia.png');
  this.load.audio('ambience',ASSET_BASE+'assets/audio/ambiente-cain-abel.mp3');
 }
 create(){
  sceneRef=this;
  const worldW=1536,worldH=864;
  this.cameras.main.setBounds(0,0,worldW,worldH);
  this.physics.world.setBounds(0,0,worldW,worldH);
  this.add.image(0,0,'bg').setOrigin(0).setDisplaySize(worldW,worldH);
  this.revealLayers=[];

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
  this.input.on('pointerup',()=>{ this.dragStart=null; });

  this.input.on('wheel',(pointer,gos,dx,dy)=>{
    this.setZoom(this.cameras.main.zoom-(dy>0?.1:-.1));
  });
  ambient=this.sound.add('ambience',{loop:true,volume:.22});
  if(state.sound && document.getElementById('presentation')?.hidden)ambient.play();
  this.setZoom(1);
 }

 collectObject(obj){
  const maskShape=this.make.graphics({x:0,y:0,add:false});
  maskShape.fillStyle(0xffffff,1);
  maskShape.fillCircle(obj.x,obj.y,obj.r*1.28);
  const cleanLayer=this.add.image(0,0,'clean').setOrigin(0).setDisplaySize(1536,864).setDepth(2).setAlpha(0);
  cleanLayer.setMask(maskShape.createGeometryMask());
  this.revealLayers.push({cleanLayer,maskShape});
  this.tweens.add({targets:cleanLayer,alpha:1,duration:260,ease:'Sine.easeOut'});

  const zone=this.objectZones&&this.objectZones.find(z=>z.getData('obj')&&z.getData('obj').id===obj.id);
  if(zone)zone.disableInteractive();

  const token=this.add.circle(obj.x,obj.y,18,0xffd45a,1).setStrokeStyle(4,0xfff3b0,1).setDepth(12);
  const label=this.add.text(obj.x,obj.y-34,obj.name,{fontFamily:'Georgia',fontSize:'24px',color:'#fff1bd',stroke:'#000000',strokeThickness:4}).setOrigin(.5).setDepth(12);
  this.tweens.add({targets:[token,label],x:1450,y:90,scale:.25,alpha:.15,duration:650,ease:'Cubic.easeIn',onComplete:()=>{token.destroy();label.destroy();}});
 }
 setZoom(z){
  z=Phaser.Math.Clamp(z,.85,1.8);
  this.cameras.main.setZoom(z);
  el('zoomReset').textContent=Math.round(z*100)+'%';
 }
 update(){}
}
const config={type:Phaser.AUTO,parent:'game',backgroundColor:'#111',physics:{default:'arcade'},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:PrototypeScene};
new Phaser.Game(config);

const presentation=el('presentation');
const startScene=el('startScene');
if(startScene)startScene.addEventListener('click',()=>{
  presentation.hidden=true;
  say('Explora la escena, encuentra los objetos y recógelos.');
  if(sceneRef&&ambient&&state.sound&&!ambient.isPlaying)ambient.play();
});

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
 state.found.clear();state.score=0;state.hints=2;completeEl.hidden=true;render();say('Prueba reiniciada. Encuentra y recoge los tres objetos.');
 if(ambient){try{ambient.stop()}catch(e){}}
 if(sceneRef)sceneRef.scene.restart();
}
el('resetBtn').addEventListener('click',reset);
el('playAgain').addEventListener('click',reset);
render();
})();