import Phaser from 'phaser';

const SAVE_KEY = 'domovik-usadba-v2';
type Building = { id: string; name: string; emoji: string; x: number; y: number; cost: number; wood: number; rate: number; level: number; color: number };
type Save = { coins: number; wood: number; stone: number; food: number; xp: number; level: number; buildings: Building[]; quests: Record<string, number>; lastSeen: number };

const BLUEPRINTS: Omit<Building,'x'|'y'|'level'>[] = [
 { id:'sawmill', name:'Лесопилка', emoji:'🌲', cost:50, wood:0, rate:2, color:0x8b5e3c },
 { id:'quarry', name:'Каменоломня', emoji:'⛏️', cost:90, wood:20, rate:3, color:0x68727b },
 { id:'garden', name:'Огород', emoji:'🥕', cost:110, wood:25, rate:1, color:0x5b8f4a },
 { id:'workshop', name:'Мастерская', emoji:'🔨', cost:180, wood:60, rate:6, color:0x9b6b3f },
 { id:'house', name:'Тёплый дом', emoji:'🏡', cost:260, wood:90, rate:10, color:0xa45b45 },
];
const initial: Save = { coins:180, wood:80, stone:40, food:20, xp:0, level:1, buildings:[], quests:{build:0, gather:0, level:0}, lastSeen:Date.now() };
function load(): Save { try { return {...initial,...JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'), buildings: JSON.parse(localStorage.getItem(SAVE_KEY)||'{}').buildings || []}; } catch { return {...initial}; } }
function save(s: Save) { s.lastSeen=Date.now(); localStorage.setItem(SAVE_KEY,JSON.stringify(s)); }

class GameScene extends Phaser.Scene {
 s=load(); hud!: Phaser.GameObjects.Text; toast?: Phaser.GameObjects.Text; modal?: Phaser.GameObjects.Container; selected?: {x:number,y:number}; tiles: Phaser.GameObjects.Container[]=[]; hero!: Phaser.GameObjects.Container; heroBody!: Phaser.GameObjects.Rectangle; timeText!: Phaser.GameObjects.Text;
 create(){
  this.cameras.main.setBackgroundColor(0xcde8c4); this.drawWorld(); this.drawHud(); this.drawHero(); this.drawBuildMenu(); this.drawQuest(); this.applyOffline();
  this.time.addEvent({delay:1000,loop:true,callback:()=>{this.tick();this.animateHero();}}); save(this.s);
 }
 drawWorld(){
  this.add.rectangle(400,300,800,600,0xcde8c4);
  for(let i=0;i<13;i++) this.add.circle(40+i*67,270+(i%3)*22,28,0x8fbe79,0.8);
  this.add.rectangle(400,355,760,390,0xb8d69d).setStrokeStyle(3,0x8aaa76);
  const spots=[[130,250],[260,250],[390,250],[520,250],[650,250],[195,385],[325,385],[455,385],[585,385]];
  spots.forEach((p,i)=>this.makePlot(i,p[0],p[1]));
  this.add.text(28,214,'ТВОЯ УСАДЬБА',{fontSize:'18px',color:'#36523a',fontStyle:'bold'});
 }
 makePlot(i:number,x:number,y:number){ const c=this.add.container(x,y); const base=this.add.rectangle(0,0,108,86,0xd8bf8c).setStrokeStyle(3,0xa58a59).setInteractive({useHandCursor:true}); c.add(base); c.add(this.add.text(0,0,'+',{fontSize:'32px',color:'#806a42'}).setOrigin(.5)); c.on('pointerdown',()=>this.openBuild(i,x,y)); this.tiles.push(c); }
 drawHud(){
  this.add.rectangle(400,48,760,78,0xf9fff4).setStrokeStyle(2,0x91ad8d);
  this.hud=this.add.text(25,18,'',{fontSize:'17px',color:'#29452f',fontStyle:'bold',lineSpacing:6}); this.updateHud();
  this.timeText=this.add.text(665,21,'',{fontSize:'13px',color:'#657966'}); this.timeText.setText('Усадьба');
 }
 updateHud(){ if(!this.hud)return; this.hud.setText(`🪙 ${this.s.coins}     🪵 ${this.s.wood}     🪨 ${this.s.stone}     🥕 ${this.s.food}     ⭐ Ур. ${this.s.level}  (${this.s.xp}/${this.s.level*100})`); }
 drawHero(){
  this.hero=this.add.container(55,190); this.heroBody=this.add.rectangle(0,12,30,34,0x6f4c8a).setStrokeStyle(2,0x4d365f); const head=this.add.circle(0,-12,15,0xd89b72).setStrokeStyle(2,0x5b3e31); const hat=this.add.triangle(0,-34,0,0,26,0,13,-19,0x4c7a52); const eye=this.add.circle(-5,-13,2,0x2d241e); const eye2=this.add.circle(5,-13,2,0x2d241e); this.hero.add([this.heroBody,head,hat,eye,eye2]); this.hero.add(this.add.text(0,39,'Лёва',{fontSize:'14px',color:'#29452f',fontStyle:'bold'}).setOrigin(.5)); this.tweens.add({targets:this.hero,y:'+=5',duration:900,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
 }
 animateHero(){ if(!this.hero)return; this.tweens.add({targets:this.heroBody,scaleX:1.04,duration:160,yoyo:true,ease:'Sine.easeInOut'}); }
 drawBuildMenu(){
  this.add.text(22,500,'СТРОИТЕЛЬСТВО',{fontSize:'17px',color:'#36523a',fontStyle:'bold'});
  this.add.text(22,525,'Нажми на пустой участок — выбери здание.',{fontSize:'13px',color:'#56705b'});
 }
 drawQuest(){ const panel=this.add.rectangle(625,500,300,135,0xf9fff4).setStrokeStyle(2,0x91ad8d); this.add.text(490,445,'ЗАДАНИЯ',{fontSize:'17px',color:'#36523a',fontStyle:'bold'}); this.add.text(490,465,'🏗 Построек:  '+this.s.buildings.length+'/3\n🪵 Собрано:  '+this.s.quests.gather+'/50\n⭐ Уровень:  '+this.s.level+'/3',{fontSize:'15px',color:'#45634b',lineSpacing:8}); }
 openBuild(slot:number,x:number,y:number){ if(this.s.buildings.some(b=>Math.hypot(b.x-x,b.y-y)<5)){this.flash('Этот участок уже занят');return;} if(this.modal)this.modal.destroy(); this.modal=this.add.container(x,y-65); const bg=this.add.rectangle(0,0,250,190,0xf9fff4).setStrokeStyle(3,0x779a77).setInteractive(); this.modal.add(bg); this.modal.add(this.add.text(0,-78,'Что построим?',{fontSize:'18px',color:'#29452f',fontStyle:'bold'}).setOrigin(.5)); BLUEPRINTS.slice(0,3).forEach((b,i)=>{const yy=-42+i*50;const btn=this.add.rectangle(0,yy,220,40,0xffffff).setStrokeStyle(2,0xb0c6ac).setInteractive({useHandCursor:true}); this.modal!.add(btn); this.modal!.add(this.add.text(-100,yy-10,`${b.emoji} ${b.name}`,{fontSize:'14px',color:'#29452f'})); this.modal!.add(this.add.text(70,yy-10,`${b.cost}🪙`,{fontSize:'13px',color:'#76551f'})); btn.on('pointerdown',()=>this.build(b,x,y));}); }
 build(bp:Omit<Building,'x'|'y'|'level'>,x:number,y:number){ if(this.s.coins<bp.cost||this.s.wood<bp.wood){this.flash('Не хватает ресурсов');return;} this.s.coins-=bp.cost;this.s.wood-=bp.wood;const b={...bp,x,y,level:1};this.s.buildings.push(b);this.s.quests.build++;this.gainXp(35);if(this.modal){this.modal.destroy();this.modal=undefined;}this.renderBuilding(b);this.flash(`${bp.emoji} ${bp.name} построено!`);save(this.s); }
 renderBuilding(b:Building){const c=this.add.container(b.x,b.y);const shadow=this.add.ellipse(0,32,82,18,0x58714f,0.18);const body=this.add.rectangle(0,0,74,55,b.color).setStrokeStyle(3,0x59452f);const roof=this.add.triangle(0,-42,-46,0,46,0,0,-48,0x7b493c);const sign=this.add.text(0,13,b.emoji,{fontSize:'25px'}).setOrigin(.5);const label=this.add.text(0,48,`${b.name} • ур.${b.level}`,{fontSize:'11px',color:'#36523a',backgroundColor:'#f9fff4',padding:{x:4,y:3}}).setOrigin(.5);c.add([shadow,body,roof,sign,label]);this.tweens.add({targets:c,scaleX:1.08,scaleY:1.08,duration:180,yoyo:true,ease:'Back.Out'});this.tweens.add({targets:roof,angle:2,duration:700,yoyo:true,repeat:-1,ease:'Sine.InOut'}); }
 tick(){ for(const b of this.s.buildings){this.s.coins+=b.rate; if(b.id==='garden')this.s.food+=1;} this.updateHud();save(this.s); }
 applyOffline(){const sec=Math.min(3600,Math.max(0,Math.floor((Date.now()-this.s.lastSeen)/1000)));if(sec>10&&this.s.buildings.length){const gain=this.s.buildings.reduce((a,b)=>a+b.rate,0)*sec;this.s.coins+=gain;this.flash(`Пока тебя не было: +${gain}🪙`);} }
 gainXp(n:number){this.s.xp+=n;while(this.s.xp>=this.s.level*100){this.s.xp-=this.s.level*100;this.s.level++;this.flash(`⭐ Новый уровень: ${this.s.level}!`);}this.updateHud();}
 flash(msg:string){this.toast?.destroy();this.toast=this.add.text(400,445,msg,{fontSize:'17px',color:'#29452f',backgroundColor:'#ffffff',padding:{x:14,y:9}}).setOrigin(.5).setDepth(20);this.tweens.add({targets:this.toast,alpha:0,y:420,duration:1300,delay:450,onComplete:()=>this.toast?.destroy()});}
}
new Phaser.Game({type:Phaser.AUTO,width:800,height:600,parent:'game',backgroundColor:'#cde8c4',scene:GameScene,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true}});
