import Phaser from 'phaser';

declare global { interface Window { YaGames?: any; ysdk?: any; } }

const SAVE_KEY = 'domovik-usadba-v2';
type BuildingId = 'hut' | 'sawmill' | 'garden' | 'workshop' | 'well';
type Save = { coins:number; wood:number; stone:number; food:number; xp:number; level:number; buildings: Record<string, BuildingId>; lastSeen:number };
const fresh = ():Save => ({ coins:120, wood:55, stone:25, food:10, xp:0, level:1, buildings:{}, lastSeen:Date.now() });
let storage: Storage = localStorage;
let ysdk: any = null;
let player: any = null;

function readLocal():Save { try { return { ...fresh(), ...JSON.parse(storage.getItem(SAVE_KEY) || '{}') }; } catch { return fresh(); } }
function writeLocal(s:Save) { s.lastSeen = Date.now(); storage.setItem(SAVE_KEY, JSON.stringify(s)); if (player?.setData) player.setData({ game:s }, false).catch(()=>{}); }

async function initYandex() {
  if (!window.YaGames) return;
  try {
    ysdk = await window.YaGames.init();
    player = await ysdk.getPlayer();
    if (ysdk.getStorage) { const safe = await ysdk.getStorage(); storage = safe; }
    const cloud = await player.getData(['game']).catch(()=>({}));
    if (cloud?.game) localStorage.setItem(SAVE_KEY, JSON.stringify(cloud.game));
    if (ysdk.features?.LoadingAPI) ysdk.features.LoadingAPI.ready();
  } catch { /* local mode */ }
}

const BUILDINGS: Record<BuildingId,{name:string; icon:string; cost:number; wood:number; stone:number; income:number; xp:number}> = {
  hut:{name:'Домик',icon:'⌂',cost:60,wood:15,stone:0,income:1,xp:25},
  sawmill:{name:'Лесопилка',icon:'▥',cost:90,wood:20,stone:5,income:4,xp:35},
  garden:{name:'Сад',icon:'♧',cost:75,wood:10,stone:8,income:3,xp:30},
  workshop:{name:'Мастерская',icon:'⚒',cost:180,wood:35,stone:25,income:8,xp:60},
  well:{name:'Колодец',icon:'◉',cost:110,wood:10,stone:30,income:2,xp:40}
};

class Scene extends Phaser.Scene {
  s = readLocal();
  ui: Record<string,Phaser.GameObjects.Text> = {};
  plots: Phaser.GameObjects.Container[] = [];
  selected = 0;
  tick = 0;
  constructor(){ super('main'); }

  create(){
    this.cameras.main.setBackgroundColor('#17301f');
    this.drawWorld();
    this.drawSidebar();
    this.reconcileOffline();
    this.update();
    this.time.addEvent({delay:1000,loop:true,callback:()=>this.passiveTick()});
    this.time.delayedCall(250,()=>initYandex());
  }

  drawWorld(){
    this.add.rectangle(0,0,560,600,0x17301f).setOrigin(0);
    this.add.rectangle(18,18,524,72,0xf6e7bd).setStrokeStyle(2,0x9d7b45);
    this.add.text(36,30,'ДОМОВИК', {fontSize:'25px',fontStyle:'bold',color:'#3b2818'});
    this.add.text(36,59,'Большая усадьба', {fontSize:'14px',color:'#735633'});
    this.add.text(480,34,'☀', {fontSize:'28px'});
    this.add.text(462,62,'День 1', {fontSize:'12px',color:'#735633'});

    // lawn
    this.add.rectangle(30,108,500,464,0x78a95e).setOrigin(0).setStrokeStyle(3,0x496f3d);
    for(let i=0;i<24;i++){
      const x=45+(i*71)%470, y=125+(i*113)%420;
      this.add.circle(x,y,2,0xb7d58c).setAlpha(.7);
    }
    const positions=[[80,165],[230,165],[380,165],[155,300],[315,300],[465,300],[80,435],[230,435],[380,435]];
    positions.forEach((p,i)=>this.makePlot(i,p[0],p[1]));
  }

  makePlot(index:number,x:number,y:number){
    const c=this.add.container(x,y).setSize(120,105).setInteractive(new Phaser.Geom.Rectangle(0,0,120,105),Phaser.Geom.Rectangle.Contains);
    this.plots[index]=c;
    c.on('pointerdown',()=>{this.selected=index; this.openBuildMenu(index);});
    const shadow=this.add.ellipse(60,83,100,24,0x294c2b,.22);
    const base=this.add.rectangle(10,20,100,60,0x9bc678).setStrokeStyle(2,0x507943);
    c.add([shadow,base]);
    this.renderPlot(index);
  }

  renderPlot(i:number){
    const c=this.plots[i]; if(!c)return;
    c.removeAll(true);
    const id=this.s.buildings[String(i)];
    c.add(this.add.ellipse(60,83,100,24,0x294c2b,.22));
    c.add(this.add.rectangle(10,20,100,60,0x9bc678).setStrokeStyle(2,0x507943));
    if(id){
      const b=BUILDINGS[id];
      c.add(this.add.rectangle(27,32,66,45,0xe6c48e).setStrokeStyle(2,0x734c2b));
      c.add(this.add.triangle(60,18,20,25,100,25,60,0,0x9b5737).setStrokeStyle(2,0x6b3928));
      c.add(this.add.text(60,43,b.icon,{fontSize:'28px',color:'#3d2b1c'}).setOrigin(.5));
      c.add(this.add.text(60,82,b.name,{fontSize:'12px',color:'#fff',backgroundColor:'#365b32',padding:{x:5,y:2}}).setOrigin(.5));
    } else {
      c.add(this.add.circle(60,50,25,0x5f934c).setStrokeStyle(2,0x3e7134));
      c.add(this.add.text(60,42,'+',{fontSize:'30px',color:'#fff'}).setOrigin(.5));
      c.add(this.add.text(60,80,'Построить',{fontSize:'12px',color:'#fff'}).setOrigin(.5));
    }
  }

  drawSidebar(){
    this.add.rectangle(560,0,240,600,0xf8f0dc).setOrigin(0);
    this.add.text(580,18,'УСАДЬБА',{fontSize:'19px',fontStyle:'bold',color:'#3b2818'});
    this.ui.coins=this.add.text(580,55,'',{fontSize:'17px',color:'#76521d'});
    this.ui.wood=this.add.text(580,82,'',{fontSize:'15px',color:'#5a4128'});
    this.ui.stone=this.add.text(580,106,'',{fontSize:'15px',color:'#4e4e4e'});
    this.ui.food=this.add.text(680,82,'',{fontSize:'15px',color:'#4f6d2e'});
    this.ui.level=this.add.text(680,106,'',{fontSize:'15px',color:'#664d8d'});
    this.add.rectangle(580,135,200,8,0xd9cdb3).setOrigin(0);
    this.ui.xpbar=this.add.rectangle(580,135,2,8,0x8d69b3).setOrigin(0);
    this.ui.quest=this.add.text(580,160,'ЗАДАНИЕ\nПострой первое здание',{fontSize:'14px',color:'#3b2818',lineSpacing:5});
    this.ui.questBox=this.add.rectangle(580,157,200,65,0xfff8e7).setOrigin(0).setStrokeStyle(1,0xd7c49d);
    this.ui.quest.setDepth(2); this.ui.questBox.setDepth(1);
    this.add.text(580,245,'СТРОИТЕЛЬСТВО',{fontSize:'15px',fontStyle:'bold',color:'#3b2818'});
    this.ui.buildHint=this.add.text(580,275,'Нажми на участок\nна карте слева.',{fontSize:'14px',color:'#6e604d',lineSpacing:6});
    this.add.text(580,350,'ЭКОНОМИКА',{fontSize:'15px',fontStyle:'bold',color:'#3b2818'});
    this.add.text(580,378,'Каждое здание даёт\nмонеты автоматически.',{fontSize:'13px',color:'#6e604d',lineSpacing:5});
    const reset=this.add.rectangle(680,500,100,34,0xe9dcc0).setStrokeStyle(1,0xbda982).setInteractive({useHandCursor:true});
    this.add.text(730,508,'Сбросить',{fontSize:'12px',color:'#59462e'}).setOrigin(.5); reset.on('pointerdown',()=>{this.s=fresh();writeLocal(this.s);this.plots.forEach((_,i)=>this.renderPlot(i));this.update();this.flash('Новая усадьба');});
  }

  openBuildMenu(i:number){
    const old=this.children.getByName('buildMenu'); old?.destroy();
    const id=this.s.buildings[String(i)];
    if(id){this.flash(`${BUILDINGS[id].name}: +${BUILDINGS[id].income} 🪙/сек`);return;}
    const menu=this.add.container(570,235).setName('buildMenu').setDepth(20);
    menu.add(this.add.rectangle(105,105,210,210,0xfff8e7).setStrokeStyle(2,0x9d7b45));
    menu.add(this.add.text(18,12,`Участок ${i+1}`,{fontSize:'16px',fontStyle:'bold',color:'#3b2818'}));
    const ids:BuildingId[]=['hut','sawmill','garden','well','workshop'];
    ids.forEach((bid,n)=>{
      const b=BUILDINGS[bid], yy=42+n*31;
      const btn=this.add.rectangle(105,yy,188,27,0xffffff).setStrokeStyle(1,0xd1bf9d).setInteractive({useHandCursor:true});
      menu.add(btn); menu.add(this.add.text(18,yy-9,`${b.icon} ${b.name}`,{fontSize:'12px',color:'#3b2818'})); menu.add(this.add.text(180,yy-9,`${b.cost}🪙`,{fontSize:'11px',color:'#76521d'}));
      btn.on('pointerdown',()=>this.build(i,bid));
    });
    const close=this.add.text(190,10,'×',{fontSize:'22px',color:'#7b5a35'}).setInteractive({useHandCursor:true}); menu.add(close); close.on('pointerdown',()=>menu.destroy());
  }

  build(i:number,id:BuildingId){
    const b=BUILDINGS[id];
    if(this.s.coins<b.cost||this.s.wood<b.wood||this.s.stone<b.stone){this.flash('Не хватает ресурсов');return;}
    this.s.coins-=b.cost; this.s.wood-=b.wood; this.s.stone-=b.stone; this.s.buildings[String(i)]=id; this.gainXp(b.xp); writeLocal(this.s);
    this.renderPlot(i); this.children.getByName('buildMenu')?.destroy(); this.flash(`${b.name} построен!`);
  }

  passiveTick(){
    this.tick++; const count=Object.values(this.s.buildings).length;
    if(count){ Object.values(this.s.buildings).forEach(id=>this.s.coins+=BUILDINGS[id].income); if(this.tick%5===0)writeLocal(this.s); this.update(); }
  }
  gainXp(n:number){this.s.xp+=n;while(this.s.xp>=this.s.level*100){this.s.xp-=this.s.level*100;this.s.level++;this.flash(`⭐ Уровень ${this.s.level}!`);}this.update();}
  reconcileOffline(){const elapsed=Math.min(8*3600,Math.max(0,Date.now()-this.s.lastSeen)/1000);const income=Object.values(this.s.buildings).reduce((n,id)=>n+BUILDINGS[id].income,0);const gain=Math.floor(elapsed*income);if(gain>0){this.s.coins+=gain;this.flash(`Пока тебя не было: +${gain} 🪙`);}writeLocal(this.s);}
  update(){
    this.ui.coins?.setText(`🪙 ${this.s.coins}`); this.ui.wood?.setText(`🪵 ${this.s.wood}`); this.ui.stone?.setText(`🪨 ${this.s.stone}`); this.ui.food?.setText(`🥕 ${this.s.food}`); this.ui.level?.setText(`⭐ Ур. ${this.s.level}`);
    if(this.ui.xpbar)this.ui.xpbar.width=200*(this.s.xp/(this.s.level*100));
    const built=Object.keys(this.s.buildings).length;
    if(this.ui.quest) this.ui.quest.setText(built===0?'ЗАДАНИЕ\nПострой первое здание':built<3?`ЗАДАНИЕ\nПострой ещё ${3-built} здания`:'ЗАДАНИЕ\nУсадьба развивается!');
  }
  flash(msg:string){const t=this.add.text(280,570,msg,{fontSize:'16px',color:'#fff',backgroundColor:'#365b32',padding:{x:12,y:7}}).setOrigin(.5).setDepth(30);this.tweens.add({targets:t,alpha:0,y:545,duration:1200,onComplete:()=>t.destroy()});}
}

new Phaser.Game({type:Phaser.AUTO,width:800,height:600,parent:'game',backgroundColor:'#17301f',scene:Scene,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
