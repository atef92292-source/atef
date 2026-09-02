import Phaser from 'phaser';

type Kind='wood'|'stone'|'food'|'tools'|'home';
type Building={id:string;name:string;short:string;x:number;y:number;cost:number;wood:number;rate:number;level:number;kind:Kind};
type Save={coins:number;wood:number;stone:number;food:number;xp:number;level:number;buildings:Building[];quests:{build:number;gather:number};lastSeen:number};

const KEY='domovik-usadba-v5';
const PLOTS=[[118,285],[260,285],[402,285],[544,285],[686,285],[190,425],[332,425],[474,425],[616,425]] as const;
const BP:Omit<Building,'x'|'y'|'level'>[]=[
{id:'sawmill',name:'Лесопилка',short:'добывает дерево',cost:50,wood:0,rate:2,kind:'wood'},
{id:'quarry',name:'Каменоломня',short:'добывает камень',cost:90,wood:20,rate:3,kind:'stone'},
{id:'garden',name:'Огород',short:'выращивает еду',cost:110,wood:25,rate:1,kind:'food'},
{id:'workshop',name:'Мастерская',short:'создаёт инструменты',cost:180,wood:60,rate:6,kind:'tools'},
{id:'house',name:'Тёплый дом',short:'развивает усадьбу',cost:260,wood:90,rate:10,kind:'home'}];

const fresh=():Save=>({coins:180,wood:80,stone:40,food:20,xp:0,level:1,buildings:[],quests:{build:0,gather:0},lastSeen:Date.now()});
function load():Save{try{const r=JSON.parse(localStorage.getItem(KEY)||'null');return r?{...fresh(),...r,buildings:Array.isArray(r.buildings)?r.buildings:[],quests:{...fresh().quests,...r.quests}}:fresh()}catch{return fresh()}}
function save(s:Save){s.lastSeen=Date.now();localStorage.setItem(KEY,JSON.stringify(s))}

class GameScene extends Phaser.Scene{
 s=load();hud!:Phaser.GameObjects.Container;hudValues:Record<string,Phaser.GameObjects.Text>={};questText!:Phaser.GameObjects.Text;hero!:Phaser.GameObjects.Container;toast?:Phaser.GameObjects.Text;modal?:Phaser.GameObjects.Container;modalX=400;modalY=310;modalButtons:{y:number;bp:typeof BP[number]}[]=[];
 constructor(){super('main')}
 create(){
  this.input.enabled=true;this.input.topOnly=true;this.cameras.main.setBackgroundColor(0x10251b);
  this.drawWorld();this.drawHud();this.drawHero();this.drawQuests();
  this.s.buildings.forEach(b=>this.drawBuilding(b,false));this.offline();
  this.input.on('pointerdown',this.handlePointer,this);
  this.time.addEvent({delay:1000,loop:true,callback:()=>{this.tick();this.breathe()}});
  save(this.s);
 }

 handlePointer(pointer:Phaser.Input.Pointer){
  const x=pointer.worldX,y=pointer.worldY;
  if(this.modal){this.handleModal(x,y);return}
  if(y<100)return;
  for(const b of this.s.buildings){if(Math.abs(x-b.x)<58&&Math.abs(y-b.y)<55){this.collect(b);return}}
  for(const [px,py] of PLOTS){if(Math.abs(x-px)<=60&&Math.abs(y-py)<=50){const occupied=this.s.buildings.some(b=>Math.abs(b.x-px)<3&&Math.abs(b.y-py)<3);if(!occupied)this.openBuild();else this.flash('Участок уже занят');return}}
 }

 drawWorld(){
  this.add.rectangle(400,300,800,600,0x8fcf73);
  for(let i=0;i<34;i++){const x=(i*83)%820-10,y=112+(i%5)*19;this.tree(x,y,0.62+(i%3)*0.07)}
  const river=this.add.graphics();river.fillStyle(0x4aa8c5,1);river.beginPath();river.moveTo(710,82);river.lineTo(800,62);river.lineTo(800,600);river.lineTo(735,600);river.lineTo(700,520);river.lineTo(720,410);river.lineTo(700,300);river.closePath();river.fillPath();
  for(let i=0;i<10;i++)this.add.ellipse(758,115+i*47,38,8,0xbbe8e8,.5);
  this.add.rectangle(400,365,760,420,0x9bd27f).setStrokeStyle(2,0x72af61);
  const path=this.add.graphics();path.fillStyle(0xd7bb7b,1);path.beginPath();path.moveTo(55,545);path.lineTo(165,415);path.lineTo(350,355);path.lineTo(625,350);path.lineTo(770,465);path.lineTo(770,515);path.lineTo(590,405);path.lineTo(350,395);path.lineTo(205,445);path.lineTo(90,570);path.closePath();path.fillPath();
  for(let x=24;x<700;x+=52){this.add.rectangle(x,542,8,34,0x805b3b);this.add.rectangle(x+2,533,48,7,0x9b7048)}
  for(let i=0;i<42;i++)this.flower(18+(i*97)%675,178+(i*53)%350,i%3);
  for(let i=0;i<13;i++)this.rock(30+(i*131)%660,205+(i*71)%320,0.7+(i%2)*.2);
  this.add.text(24,122,'УСАДЬБА ЛЁВЫ',{fontFamily:'Trebuchet MS',fontSize:'26px',fontStyle:'bold',color:'#fff3c8',stroke:'#5c3f2c',strokeThickness:7});
  this.add.text(27,153,'Маленький дом. Большая история.',{fontFamily:'Trebuchet MS',fontSize:'14px',color:'#f6ffe7',stroke:'#41603d',strokeThickness:3});
  this.panel(400,112,390,48,0xf7e3ac,0x8b613e,3);this.add.text(400,112,'СТРОЙ  •  СОБИРАЙ  •  РАЗВИВАЙ',{fontFamily:'Trebuchet MS',fontSize:'14px',fontStyle:'bold',color:'#5a412d'}).setOrigin(.5);
  this.house(640,205,.9);PLOTS.forEach(p=>this.plot(p[0],p[1]));
 }
 plot(x:number,y:number){if(this.s.buildings.some(b=>Math.abs(b.x-x)<3&&Math.abs(b.y-y)<3))return;const g=this.add.graphics();g.fillStyle(0xd8b86f,1);g.fillRoundedRect(x-53,y-40,106,80,10);g.lineStyle(3,0xb0894c,1);g.strokeRoundedRect(x-53,y-40,106,80,10);g.lineStyle(2,0xf3dba0,1);g.strokeRoundedRect(x-47,y-34,94,68,8);this.add.text(x,y-3,'+',{fontFamily:'Trebuchet MS',fontSize:'38px',fontStyle:'bold',color:'#8a6737'}).setOrigin(.5);this.add.text(x,y+24,'ПОСТРОИТЬ',{fontFamily:'Trebuchet MS',fontSize:'9px',fontStyle:'bold',color:'#8a6737'}).setOrigin(.5)}

 drawHud(){
  this.hud=this.add.container(400,51).setDepth(30);this.panel(0,0,750,72,0xfff2cb,0x9a7048,3,this.hud);
  const items=[['coin',-300,'Монеты'],['wood',-165,'Дерево'],['stone',-30,'Камень'],['food',105,'Еда']];
  items.forEach(([kind,x,label])=>{const xx=Number(x);this.icon(kind,xx,-1,this.hud);const t1=this.add.text(xx+21,-13,label,{fontFamily:'Trebuchet MS',fontSize:'9px',color:'#806344'}).setOrigin(0,.5);const t2=this.add.text(xx+21,9,this.value(kind),{fontFamily:'Trebuchet MS',fontSize:'16px',fontStyle:'bold',color:'#4d3928'}).setOrigin(0,.5);this.hud.add([t1,t2]);this.hudValues[kind]=t2});
  this.hud.add(this.add.text(212,-13,'УРОВЕНЬ',{fontFamily:'Trebuchet MS',fontSize:'9px',color:'#806344'}).setOrigin(0,.5));const xp=this.add.text(212,9,`★ ${this.s.level}   ${this.s.xp}/${this.s.level*100} XP`,{fontFamily:'Trebuchet MS',fontSize:'15px',fontStyle:'bold',color:'#4d3928'}).setOrigin(0,.5);this.hud.add(xp);this.hudValues.xp=xp;
 }
 value(k:string){if(k==='coin')return String(this.s.coins);if(k==='wood')return String(this.s.wood);if(k==='stone')return String(this.s.stone);return String(this.s.food)}
 updateHud(){for(const k of ['coin','wood','stone','food'])this.hudValues[k]?.setText(this.value(k));this.hudValues.xp?.setText(`★ ${this.s.level}   ${this.s.xp}/${this.s.level*100} XP`);this.questText?.setText(`ПОСТРОЙ 3 ЗДАНИЯ        ${Math.min(3,this.s.quests.build)}/3\nСОБЕРИ 50 ДЕРЕВА       ${Math.min(50,this.s.quests.gather)}/50\nДОСТИГНИ 3 УРОВНЯ      ${Math.min(3,this.s.level)}/3`)}

 drawHero(){
  this.hero=this.add.container(88,270).setDepth(18);const g=this.add.graphics();g.fillStyle(0x35563b,.25);g.fillEllipse(0,53,72,18);g.fillStyle(0x7956c5,1);g.fillRoundedRect(-22,-2,44,62,11);g.fillStyle(0x7e5bd0,1);g.fillTriangle(-25,50,0,73,25,50);g.fillStyle(0xf0ae80,1);g.fillCircle(0,-29,24);g.fillStyle(0x4a2e25,1);g.fillCircle(0,-40,25);g.fillTriangle(-17,-50,0,-65,18,-50);g.fillStyle(0x2a2422,1);g.fillCircle(-8,-30,3);g.fillCircle(8,-30,3);g.lineStyle(2,0x7a443d,1);g.arc(0,-22,8,10,170,false);g.fillStyle(0xe6c766,1);g.fillCircle(-15,13,5);g.fillCircle(15,13,5);this.hero.add(g);this.hero.add(this.add.text(0,84,'ЛЁВА',{fontFamily:'Trebuchet MS',fontSize:'15px',fontStyle:'bold',color:'#fff4cf',stroke:'#5b4230',strokeThickness:4}).setOrigin(.5));this.hero.add(this.add.text(0,104,'Хозяин усадьбы',{fontFamily:'Trebuchet MS',fontSize:'10px',color:'#fff'}).setOrigin(.5));this.add.text(88,350,'Кликай по зданиям —\nсобирай бонусы!',{fontFamily:'Trebuchet MS',fontSize:'11px',align:'center',color:'#fff4d0',stroke:'#486844',strokeThickness:3}).setOrigin(.5).setDepth(19);this.tweens.add({targets:this.hero,y:'+=4',duration:900,yoyo:true,repeat:-1,ease:'Sine.InOut'})}
 breathe(){if(this.hero)this.tweens.add({targets:this.hero.scale,x:1.02,y:1.02,duration:240,yoyo:true,ease:'Sine.InOut'})}

 drawQuests(){this.panel(612,520,330,120,0xfff1d0,0x9a7048,3);this.add.text(612,476,'ЗАДАНИЯ',{fontFamily:'Trebuchet MS',fontSize:'18px',fontStyle:'bold',color:'#5c402d'}).setOrigin(.5);this.questText=this.add.text(478,500,'',{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#68513b',lineSpacing:9});this.updateHud()}

 openBuild(){
  this.closeModal();this.modalX=400;this.modalY=315;this.modal=this.add.container(this.modalX,this.modalY).setDepth(70);this.panel(0,0,520,390,0xfff5da,0x8d6544,4,this.modal);this.modal.add(this.add.text(0,-164,'Что построим?',{fontFamily:'Trebuchet MS',fontSize:'25px',fontStyle:'bold',color:'#513a29'}).setOrigin(.5));this.modal.add(this.add.text(0,-136,'Выбери новое сердце для усадьбы',{fontFamily:'Trebuchet MS',fontSize:'12px',color:'#8b6c50'}).setOrigin(.5));this.modal.add(this.add.text(235,-163,'×',{fontFamily:'Trebuchet MS',fontSize:'28px',fontStyle:'bold',color:'#8b4e3e'}).setOrigin(.5));this.modalButtons=[];
  BP.forEach((b,i)=>{const yy=-95+i*57;const r=this.add.rectangle(0,yy,450,48,0xfffcf1).setStrokeStyle(2,0xd4bd93);this.modal!.add(r);this.modal!.add(this.add.text(-195,yy-8,b.name,{fontFamily:'Trebuchet MS',fontSize:'15px',fontStyle:'bold',color:'#55402f'}));this.modal!.add(this.add.text(-195,yy+12,b.short,{fontFamily:'Trebuchet MS',fontSize:'10px',color:'#9a7656'}));this.modal!.add(this.add.text(128,yy-4,`${b.cost} монет`,{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#89622e'}));if(b.wood)this.modal!.add(this.add.text(128,yy+13,`+ ${b.wood} дерева`,{fontFamily:'Trebuchet MS',fontSize:'9px',color:'#6e5a45'}));this.modalButtons.push({y:yy,bp:b});this.tweens.add({targets:r,scaleX:1.01,scaleY:1.01,duration:700,yoyo:true,repeat:-1,ease:'Sine.InOut',delay:i*80})});
  this.modal.setAlpha(0);this.tweens.add({targets:this.modal,alpha:1,duration:180,ease:'Quad.Out'});
 }
 handleModal(x:number,y:number){if(x>625&&y>125&&y<205){this.closeModal();return}if(Math.abs(x-this.modalX)>265||Math.abs(y-this.modalY)>205){this.closeModal();return}const local=y-this.modalY;for(const b of this.modalButtons){if(Math.abs(local-b.y)<25){this.build(b.bp);return}}}
 closeModal(){this.modal?.destroy();this.modal=undefined;this.modalButtons=[]}

 build(bp:Omit<Building,'x'|'y'|'level'>){if(this.s.coins<bp.cost||this.s.wood<bp.wood){this.flash('Не хватает ресурсов');return}const empty=PLOTS.find(p=>!this.s.buildings.some(b=>Math.abs(b.x-p[0])<3&&Math.abs(b.y-p[1])<3));if(!empty){this.flash('Все участки заняты');return}this.s.coins-=bp.cost;this.s.wood-=bp.wood;const b={...bp,x:empty[0],y:empty[1],level:1};this.s.buildings.push(b);this.s.quests.build++;this.gain(35);this.closeModal();this.drawBuilding(b,true);this.flash(`${bp.name} построена!`);save(this.s)}

 drawBuilding(b:Building,pop=true){const c=this.add.container(b.x,b.y).setDepth(9);c.add(this.add.ellipse(0,34,88,20,0x34553a,.22));if(b.kind==='wood')this.sawmill(c);if(b.kind==='stone')this.quarry(c);if(b.kind==='food')this.garden(c);if(b.kind==='tools')this.workshop(c);if(b.kind==='home')this.home(c);c.add(this.add.text(0,58,`${b.name}  •  ур.${b.level}`,{fontFamily:'Trebuchet MS',fontSize:'9px',fontStyle:'bold',color:'#503b2b',backgroundColor:'#fff0c5',padding:{x:6,y:4}}).setOrigin(.5));if(pop){c.setScale(.1);this.tweens.add({targets:c,scale:1,duration:520,ease:'Back.Out'});this.burst(b.x,b.y)}this.tweens.add({targets:c,y:'-=1',duration:1100,yoyo:true,repeat:-1,ease:'Sine.InOut',delay:Phaser.Math.Between(0,300)})}
 sawmill(c:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(0x8e5a38,1);g.fillRoundedRect(-39,-12,78,43,7);g.fillStyle(0x6d4630,1);g.fillTriangle(-48,-12,0,-55,48,-12);g.fillStyle(0x66808a,1);g.fillCircle(25,13,17);g.lineStyle(3,0xd9b85d,1);g.lineBetween(8,13,42,13);g.lineBetween(25,-4,25,30);g.fillStyle(0xb97842,1);g.fillRect(-55,19,35,10);g.fillRect(-55,31,28,8);c.add(g);c.add(this.add.text(0,-10,'ЛЕС',{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#fff0c5'}).setOrigin(.5))}
 quarry(c:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(0x7d8990,1);g.fillRoundedRect(-40,-18,80,50,8);g.fillStyle(0x59636b,1);g.fillTriangle(-48,-18,0,-57,48,-18);g.fillStyle(0xb9c4c7,1);g.fillCircle(-15,8,11);g.fillCircle(12,2,15);g.fillCircle(25,17,9);g.lineStyle(5,0xd7b45e,1);g.lineBetween(-3,-37,25,-7);c.add(g)}
 garden(c:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(0xc88e4e,1);g.fillRoundedRect(-43,-18,86,50,8);g.fillStyle(0x5f9953,1);g.fillTriangle(-52,-18,0,-58,52,-18);for(let i=-25;i<=25;i+=16){g.lineStyle(4,0x4f7e43,1);g.lineBetween(i,8,i,30);g.fillStyle(0x6eb15b,1);g.fillCircle(i-4,2,7);g.fillCircle(i+4,1,7)}c.add(g);c.add(this.add.text(0,-11,'САД',{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#fff0c5'}).setOrigin(.5))}
 workshop(c:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(0x9d6b40,1);g.fillRoundedRect(-42,-18,84,50,8);g.fillStyle(0x704a36,1);g.fillTriangle(-50,-18,0,-58,50,-18);g.fillStyle(0xe2b55d,1);g.fillRect(-10,-3,20,9);g.fillStyle(0x6e8490,1);g.fillCircle(0,1,5);g.lineStyle(4,0x5e4634,1);g.lineBetween(-20,18,20,18);c.add(g);c.add(this.add.text(0,-11,'МАСТЕР',{fontFamily:'Trebuchet MS',fontSize:'11px',fontStyle:'bold',color:'#fff0c5'}).setOrigin(.5))}
 home(c:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(0xe7d19c,1);g.fillRoundedRect(-42,-20,84,54,7);g.fillStyle(0xa64f43,1);g.fillTriangle(-50,-20,0,-66,50,-20);g.fillStyle(0x6b91a0,1);g.fillRoundedRect(-28,-8,20,20,3);g.fillStyle(0x7c5437,1);g.fillRoundedRect(9,5,17,29,3);g.fillStyle(0xf4d36c,1);g.fillCircle(19,20,2);c.add(g);c.add(this.add.text(0,-10,'ДОМ',{fontFamily:'Trebuchet MS',fontSize:'12px',fontStyle:'bold',color:'#fff0c5'}).setOrigin(.5))}

 collect(b:Building){const coins=3+b.level;this.s.coins+=coins;this.s.xp+=2;if(b.kind==='wood'){this.s.wood+=2;this.s.quests.gather=Math.min(50,this.s.quests.gather+2)}if(b.kind==='stone')this.s.stone++;if(b.kind==='food')this.s.food+=2;this.gain(0);this.burst(b.x,b.y);this.flash(`+${coins} монет  •  ${b.name}`);this.updateHud();save(this.s)}
 tick(){for(const b of this.s.buildings){this.s.coins+=b.rate;if(b.kind==='wood')this.s.wood++;if(b.kind==='food')this.s.food++}this.gain(0);this.updateHud();save(this.s)}
 offline(){const sec=Math.min(3600,Math.max(0,Math.floor((Date.now()-this.s.lastSeen)/1000)));if(sec>20&&this.s.buildings.length){const gain=this.s.buildings.reduce((n,b)=>n+b.rate,0)*sec;this.s.coins+=gain;this.flash(`Пока тебя не было: +${gain} монет`);this.updateHud()}}
 gain(n:number){this.s.xp+=n;while(this.s.xp>=this.s.level*100){this.s.xp-=this.s.level*100;this.s.level++;this.flash(`Новый уровень: ${this.s.level}!`)}this.updateHud()}

 panel(x:number,y:number,w:number,h:number,fill:number,stroke:number,line=2,parent?:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(fill,1);g.fillRoundedRect(x-w/2,y-h/2,w,h,14);g.lineStyle(line,stroke,1);g.strokeRoundedRect(x-w/2,y-h/2,w,h,14);if(parent)parent.add(g);return g}
 icon(kind:string,x:number,y:number,parent:Phaser.GameObjects.Container){const g=this.add.graphics();g.fillStyle(0xfff7df,1);g.fillCircle(x,y,19);g.lineStyle(2,0xd2ad67,1);g.strokeCircle(x,y,19);if(kind==='coin'){g.fillStyle(0xe8b943,1);g.fillCircle(x,y,10);g.fillStyle(0xffef9d,1);g.fillCircle(x,y,5)}else if(kind==='wood'){g.fillStyle(0x8e5b38,1);g.fillRoundedRect(x-9,y-5,18,10,4);g.lineStyle(2,0x5d3e2a,1);g.lineBetween(x-2,y-5,x-2,y+5)}else if(kind==='stone'){g.fillStyle(0x88949a,1);g.fillTriangle(x-11,y+7,x-4,y-9,x+12,y+5)}else{g.fillStyle(0xe78d35,1);g.fillTriangle(x-4,y-10,x+5,y+8,x-10,y+6)}parent.add(g)}
 tree(x:number,y:number,s:number){const g=this.add.graphics();g.fillStyle(0x76523b,1);g.fillRect(x-5*s,y+8*s,10*s,32*s);g.fillStyle(0x2f7040,1);g.fillCircle(x,y,25*s);g.fillStyle(0x438b4e,1);g.fillCircle(x-14*s,y+4*s,17*s);g.fillCircle(x+14*s,y+6*s,17*s)}
 flower(x:number,y:number,k:number){const g=this.add.graphics();g.fillStyle(0x4f8b43,1);g.fillRect(x-1,y,x+1-x,y+9);g.fillStyle([0xf5d35d,0xe98b91,0xa7c8ed][k],1);g.fillCircle(x,y,3);g.fillCircle(x-4,y,3);g.fillCircle(x+4,y,3);g.fillCircle(x,y-4,3);g.fillStyle(0xe9c34c,1);g.fillCircle(x,y,2)}
 rock(x:number,y:number,s:number){const g=this.add.graphics();g.fillStyle(0x71817d,.75);g.fillEllipse(x,y,22*s,13*s);g.fillStyle(0x9aa6a1,.6);g.fillEllipse(x-4*s,y-2*s,9*s,5*s)}
 house(x:number,y:number,s:number){const g=this.add.graphics();g.fillStyle(0xe7d19c,1);g.fillRoundedRect(x-46*s,y-18*s,92*s,58*s,7*s);g.fillStyle(0xa64f43,1);g.fillTriangle(x-56*s,y-18*s,x,y-68*s,x+56*s,y-18*s);g.fillStyle(0x6b91a0,1);g.fillRoundedRect(x-28*s,y-8*s,20*s,20*s,3*s);g.fillStyle(0x7c5437,1);g.fillRoundedRect(x+9*s,y+5*s,17*s,35*s,3*s);g.fillStyle(0xf4d36c,1);g.fillCircle(x+19*s,y+21*s,2*s)}
 burst(x:number,y:number){for(let i=0;i<9;i++){const p=this.add.circle(x,y,3,0xffe08a).setDepth(80);this.tweens.add({targets:p,x:x+Phaser.Math.Between(-55,55),y:y+Phaser.Math.Between(-55,5),alpha:0,scale:.3,duration:600,delay:i*30,onComplete:()=>p.destroy()})}}
 flash(msg:string){this.toast?.destroy();this.toast=this.add.text(400,455,msg,{fontFamily:'Trebuchet MS',fontSize:'16px',fontStyle:'bold',color:'#503724',backgroundColor:'#fff0c5',padding:{x:16,y:10}}).setOrigin(.5).setDepth(90);this.tweens.add({targets:this.toast,y:425,alpha:0,duration:1500,delay:500,onComplete:()=>this.toast?.destroy()})}
}

new Phaser.Game({type:Phaser.AUTO,width:800,height:600,parent:'game',scene:GameScene,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true},input:{activePointers:2,touch:true,mouse:true}});
