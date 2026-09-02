import Phaser from 'phaser';

type Kind = 'wood' | 'stone' | 'food' | 'tools' | 'home';
type Building = { id: string; name: string; short: string; x: number; y: number; cost: number; wood: number; rate: number; level: number; kind: Kind };
type Save = { coins: number; wood: number; stone: number; food: number; xp: number; level: number; buildings: Building[]; quests: { build: number; gather: number }; lastSeen: number };
type Plot = readonly [number, number];

const KEY = 'domovik-usadba-v7';
const PLOTS: Plot[] = [[120, 300], [260, 300], [400, 300], [540, 300], [680, 300], [190, 445], [330, 445], [470, 445], [610, 445]];
const BP: Omit<Building, 'x' | 'y' | 'level'>[] = [
  { id: 'sawmill', name: 'Лесопилка', short: 'Дерево · +2/с', cost: 50, wood: 0, rate: 2, kind: 'wood' },
  { id: 'quarry', name: 'Каменоломня', short: 'Камень · +3/с', cost: 90, wood: 20, rate: 3, kind: 'stone' },
  { id: 'garden', name: 'Огород', short: 'Еда · +1/с', cost: 110, wood: 25, rate: 1, kind: 'food' },
  { id: 'workshop', name: 'Мастерская', short: 'Монеты · +6/с', cost: 180, wood: 60, rate: 6, kind: 'tools' },
  { id: 'house', name: 'Тёплый дом', short: 'Монеты · +10/с', cost: 260, wood: 90, rate: 10, kind: 'home' }
];
const ASSET: Record<Kind, string> = { wood: 'sawmill', stone: 'quarry', food: 'garden', tools: 'workshop', home: 'house' };

const fresh = (): Save => ({ coins: 180, wood: 80, stone: 40, food: 20, xp: 0, level: 1, buildings: [], quests: { build: 0, gather: 0 }, lastSeen: Date.now() });
function load(): Save {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    return r ? { ...fresh(), ...r, buildings: Array.isArray(r.buildings) ? r.buildings : [], quests: { ...fresh().quests, ...r.quests } } : fresh();
  } catch { return fresh(); }
}
function save(s: Save) { s.lastSeen = Date.now(); localStorage.setItem(KEY, JSON.stringify(s)); }

class GameScene extends Phaser.Scene {
  s = load();
  hud!: Phaser.GameObjects.Container;
  vals: Record<string, Phaser.GameObjects.Text> = {};
  quest!: Phaser.GameObjects.Text;
  hero!: Phaser.GameObjects.Image;
  hover!: Phaser.GameObjects.Graphics;
  modal?: Phaser.GameObjects.Container;
  rows: { y: number; bp: typeof BP[number] }[] = [];
  selectedPlot: Plot | null = null;
  toast?: Phaser.GameObjects.Text;
  buildingObjects = new Map<string, Phaser.GameObjects.Container>();

  constructor() { super('main'); }

  preload() {
    this.load.svg('hero', '/assets/hero.svg', { width: 180, height: 220 });
    this.load.svg('house', '/assets/house.svg', { width: 200, height: 170 });
    this.load.svg('sawmill', '/assets/sawmill.svg', { width: 180, height: 150 });
    this.load.svg('quarry', '/assets/quarry.svg', { width: 180, height: 150 });
    this.load.svg('garden', '/assets/garden.svg', { width: 180, height: 150 });
    this.load.svg('workshop', '/assets/workshop.svg', { width: 180, height: 150 });
  }

  create() {
    this.input.enabled = true;
    this.input.topOnly = true;
    this.cameras.main.setBackgroundColor(0x10251b);
    this.drawWorld();
    this.drawHud();
    this.drawHero();
    this.drawQuests();
    this.s.buildings.forEach(b => this.drawBuilding(b, false));
    this.offline();
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.wasTouch) this.pointerDown(p); }, this);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    save(this.s);
  }

  pointerDown(p: Phaser.Input.Pointer) {
    const x = p.worldX, y = p.worldY;
    if (this.modal) { this.modalClick(x, y); return; }
    if (y < 86) return;
    for (const b of this.s.buildings) {
      if (Math.abs(x - b.x) < 70 && Math.abs(y - b.y) < 62) { this.collect(b); return; }
    }
    for (const plot of PLOTS) {
      if (Math.abs(x - plot[0]) < 60 && Math.abs(y - plot[1]) < 48) {
        const occupied = this.s.buildings.some(b => Math.abs(b.x - plot[0]) < 3 && Math.abs(b.y - plot[1]) < 3);
        if (!occupied) { this.selectedPlot = plot; this.openBuild(); }
        return;
      }
    }
  }

  pointerMove(p: Phaser.Input.Pointer) {
    this.hover.clear();
    if (this.modal) return;
    for (const b of this.s.buildings) {
      if (Math.abs(p.worldX - b.x) < 70 && Math.abs(p.worldY - b.y) < 62) {
        this.hover.lineStyle(4, 0xffe7a0, 0.95); this.hover.strokeCircle(b.x, b.y - 8, 60); return;
      }
    }
    for (const [x, y] of PLOTS) {
      if (Math.abs(p.worldX - x) < 60 && Math.abs(p.worldY - y) < 48 && !this.s.buildings.some(b => Math.abs(b.x - x) < 3 && Math.abs(b.y - y) < 3)) {
        this.hover.lineStyle(4, 0xffe7a0, 0.95); this.hover.strokeRoundedRect(x - 58, y - 46, 116, 92, 16); return;
      }
    }
  }

  drawWorld() {
    this.add.rectangle(400, 300, 800, 600, 0x8fcf73);
    this.add.rectangle(400, 180, 800, 170, 0x9bdc83);
    for (let i = 0; i < 24; i++) this.tree(28 + (i * 113) % 700, 116 + (i * 37) % 90, 0.65 + (i % 3) * 0.08);
    const river = this.add.graphics(); river.fillStyle(0x49a9ca, 1); river.beginPath(); river.moveTo(720, 75); river.lineTo(800, 58); river.lineTo(800, 600); river.lineTo(748, 600); river.lineTo(711, 520); river.lineTo(728, 420); river.lineTo(708, 315); river.closePath(); river.fillPath();
    for (let i = 0; i < 9; i++) this.add.ellipse(765, 108 + i * 50, 38, 7, 0xc8f2f1, 0.5);
    const meadow = this.add.graphics(); meadow.fillStyle(0xa4d681, 1); meadow.fillRoundedRect(22, 226, 690, 350, 28); meadow.lineStyle(3, 0x6fa55e, 0.7); meadow.strokeRoundedRect(22, 226, 690, 350, 28);
    const path = this.add.graphics(); path.fillStyle(0xd9bd7e, 1); path.beginPath(); path.moveTo(35, 575); path.lineTo(185, 430); path.lineTo(355, 370); path.lineTo(615, 370); path.lineTo(780, 475); path.lineTo(780, 525); path.lineTo(600, 415); path.lineTo(350, 410); path.lineTo(205, 460); path.lineTo(82, 590); path.closePath(); path.fillPath();
    for (let i = 0; i < 38; i++) this.flower(35 + (i * 97) % 665, 260 + (i * 61) % 290, i % 3);
    for (let i = 0; i < 11; i++) this.rock(40 + (i * 137) % 650, 270 + (i * 73) % 280, 0.7 + (i % 2) * 0.2);
    for (let x = 28; x < 700; x += 50) { this.add.rectangle(x, 548, 7, 34, 0x765238); this.add.rectangle(x + 2, 539, 46, 7, 0x9a6c44); }
    this.add.text(28, 118, 'УСАДЬБА ЛЁВЫ', { fontFamily: 'Trebuchet MS', fontSize: '29px', fontStyle: 'bold', color: '#fff0c3', stroke: '#5c3e2d', strokeThickness: 8 });
    this.add.text(31, 151, 'Маленький дом · большая история', { fontFamily: 'Trebuchet MS', fontSize: '14px', color: '#f6ffe8', stroke: '#41613d', strokeThickness: 3 });
    this.panel(400, 111, 390, 48, 0xffe8b1, 0x8c603d, 3);
    this.add.text(400, 111, 'СТРОЙ  ·  СОБИРАЙ  ·  РАЗВИВАЙ', { fontFamily: 'Trebuchet MS', fontSize: '14px', fontStyle: 'bold', color: '#59402d' }).setOrigin(0.5);
    this.add.image(650, 192, 'house').setScale(0.58).setDepth(5);
    this.hover = this.add.graphics().setDepth(60);
    PLOTS.forEach(p => this.plot(p[0], p[1]));
  }

  plot(x: number, y: number) {
    const g = this.add.graphics(); g.fillStyle(0xd6b36c, 1); g.fillRoundedRect(x - 55, y - 43, 110, 86, 15); g.lineStyle(3, 0xa87942, 1); g.strokeRoundedRect(x - 55, y - 43, 110, 86, 15); g.lineStyle(2, 0xf6dda0, 1); g.strokeRoundedRect(x - 48, y - 36, 96, 72, 11);
    this.add.text(x, y - 6, '+', { fontFamily: 'Trebuchet MS', fontSize: '38px', fontStyle: 'bold', color: '#7d5b31' }).setOrigin(0.5);
    this.add.text(x, y + 23, 'ПОСТРОИТЬ', { fontFamily: 'Trebuchet MS', fontSize: '9px', fontStyle: 'bold', color: '#866338' }).setOrigin(0.5);
  }

  drawHud() {
    this.hud = this.add.container(400, 50).setDepth(40); this.panel(0, 0, 752, 72, 0xfff0c6, 0x956b46, 3, this.hud);
    const items: [string, number, string][] = [['coin', -302, 'Монеты'], ['wood', -165, 'Дерево'], ['stone', -28, 'Камень'], ['food', 109, 'Еда']];
    for (const [k, x, label] of items) { this.icon(k, x, 0, this.hud); this.hud.add(this.add.text(x + 22, -13, label, { fontFamily: 'Trebuchet MS', fontSize: '9px', color: '#7b6046' }).setOrigin(0, .5)); const t = this.add.text(x + 22, 9, this.value(k), { fontFamily: 'Trebuchet MS', fontSize: '16px', fontStyle: 'bold', color: '#453426' }).setOrigin(0, .5); this.hud.add(t); this.vals[k] = t; }
    this.hud.add(this.add.text(214, -13, 'УРОВЕНЬ', { fontFamily: 'Trebuchet MS', fontSize: '9px', color: '#7b6046' }).setOrigin(0, .5)); this.vals.xp = this.add.text(214, 9, '', { fontFamily: 'Trebuchet MS', fontSize: '15px', fontStyle: 'bold', color: '#453426' }).setOrigin(0, .5); this.hud.add(this.vals.xp); this.updateHud();
  }

  drawHero() {
    this.hero = this.add.image(86, 284, 'hero').setScale(.48).setDepth(20); this.hero.setOrigin(.5, .5);
    this.tweens.add({ targets: this.hero, y: 278, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.add.text(86, 365, 'ЛЁВА', { fontFamily: 'Trebuchet MS', fontSize: '16px', fontStyle: 'bold', color: '#fff1c7', stroke: '#51382b', strokeThickness: 5 }).setOrigin(.5).setDepth(21);
    this.add.text(86, 386, 'Хозяин усадьбы', { fontFamily: 'Trebuchet MS', fontSize: '10px', color: '#fff' }).setOrigin(.5).setDepth(21);
  }

  drawQuests() {
    this.panel(610, 523, 330, 116, 0xffefd0, 0x956b46, 3); this.add.text(610, 482, 'ЗАДАНИЯ', { fontFamily: 'Trebuchet MS', fontSize: '18px', fontStyle: 'bold', color: '#5b402e' }).setOrigin(.5); this.quest = this.add.text(478, 504, '', { fontFamily: 'Trebuchet MS', fontSize: '12px', fontStyle: 'bold', color: '#68513d', lineSpacing: 9 }); this.updateHud();
  }

  openBuild() {
    this.closeModal(); this.modal = this.add.container(400, 318).setDepth(90); this.panel(0, 0, 540, 416, 0xfff7df, 0x8a6040, 5, this.modal);
    this.modal.add(this.add.text(0, -181, 'ЧТО ПОСТРОИМ?', { fontFamily: 'Trebuchet MS', fontSize: '25px', fontStyle: 'bold', color: '#4e3829' }).setOrigin(.5));
    this.modal.add(this.add.text(0, -151, this.selectedPlot ? `Участок ${this.PlotNumber(this.selectedPlot)}` : 'Выбери новое сердце усадьбы', { fontFamily: 'Trebuchet MS', fontSize: '12px', color: '#8b6b51' }).setOrigin(.5));
    this.modal.add(this.add.text(244, -180, '×', { fontFamily: 'Trebuchet MS', fontSize: '28px', fontStyle: 'bold', color: '#8b4e3e' }).setOrigin(.5)); this.rows = [];
    BP.forEach((b, i) => { const yy = -108 + i * 58; const r = this.add.rectangle(0, yy, 462, 49, 0xfffdf3).setStrokeStyle(2, 0xd7c29a); this.modal!.add(r); this.modal!.add(this.add.image(-202, yy, ASSET[b.kind]).setScale(.15)); this.modal!.add(this.add.text(-165, yy - 9, b.name, { fontFamily: 'Trebuchet MS', fontSize: '15px', fontStyle: 'bold', color: '#55402f' })); this.modal!.add(this.add.text(-165, yy + 11, b.short, { fontFamily: 'Trebuchet MS', fontSize: '10px', color: '#98765b' })); this.modal!.add(this.add.text(126, yy - 4, `${b.cost} монет`, { fontFamily: 'Trebuchet MS', fontSize: '12px', fontStyle: 'bold', color: '#805c2e' })); if (b.wood) this.modal!.add(this.add.text(126, yy + 14, `+ ${b.wood} дерева`, { fontFamily: 'Trebuchet MS', fontSize: '9px', color: '#6e5a45' })); this.rows.push({ y: yy, bp: b }); });
    this.modal.setAlpha(0); this.tweens.add({ targets: this.modal, alpha: 1, scale: 1, duration: 180, ease: 'Quad.Out' });
  }

  PlotNumber(p: Plot) { return PLOTS.findIndex(q => q[0] === p[0] && q[1] === p[1]) + 1; }

  modalClick(x: number, y: number) {
    if (!this.modal) return; if (Math.abs(x - 400) > 285 || Math.abs(y - 318) > 225) { this.closeModal(); return; }
    const local = y - 318; for (const row of this.rows) if (Math.abs(local - row.y) < 25) { this.build(row.bp); return; }
    if (x > 620 && y < 160) this.closeModal();
  }

  closeModal() { this.modal?.destroy(); this.modal = undefined; this.rows = []; this.selectedPlot = null; }

  build(bp: Omit<Building, 'x' | 'y' | 'level'>) {
    if (!this.selectedPlot) { this.flash('Сначала выбери участок'); return; }
    if (this.s.coins < bp.cost || this.s.wood < bp.wood) { this.flash('Не хватает ресурсов'); return; }
    const [x, y] = this.selectedPlot; if (this.s.buildings.some(b => Math.abs(b.x - x) < 3 && Math.abs(b.y - y) < 3)) { this.flash('Участок уже занят'); return; }
    this.s.coins -= bp.cost; this.s.wood -= bp.wood; const b: Building = { ...bp, x, y, level: 1 }; this.s.buildings.push(b); this.s.quests.build = Math.min(3, this.s.quests.build + 1); this.gain(35); this.closeModal(); this.drawBuilding(b, true); this.flash(`${bp.name} построена!`); this.updateHud(); save(this.s);
  }

  drawBuilding(b: Building, pop = true) {
    const c = this.add.container(b.x, b.y).setDepth(10); this.buildingObjects.set(b.id + ':' + b.x + ':' + b.y, c);
    const shadow = this.add.ellipse(0, 47, 104, 22, 0x274c34, .2); c.add(shadow);
    const img = this.add.image(0, 0, ASSET[b.kind]).setScale(.63); c.add(img);
    const badge = this.add.text(0, 63, `${b.name} · ур.${b.level}`, { fontFamily: 'Trebuchet MS', fontSize: '10px', fontStyle: 'bold', color: '#315038', backgroundColor: '#fff1ce', padding: { x: 6, y: 4 } }).setOrigin(.5); c.add(badge);
    const rate = this.add.text(0, 84, `+${b.rate}/с  ·  КЛИК = БОНУС`, { fontFamily: 'Trebuchet MS', fontSize: '9px', fontStyle: 'bold', color: '#fff', stroke: '#365b3a', strokeThickness: 3 }).setOrigin(.5); c.add(rate);
    if (pop) { c.setScale(.08); this.tweens.add({ targets: c, scale: 1, duration: 520, ease: 'Back.Out' }); this.burst(b.x, b.y); }
    this.tweens.add({ targets: img, y: -3, duration: 1300 + b.level * 80, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  collect(b: Building) { const gain = 7 + b.rate * 2; this.s.coins += gain; this.s.quests.gather = Math.min(50, this.s.quests.gather + Math.max(1, b.rate)); if (b.kind === 'wood') this.s.wood += 2; if (b.kind === 'stone') this.s.stone += 2; if (b.kind === 'food') this.s.food += 2; this.gain(8); this.burst(b.x, b.y); this.flash(`+${gain} монет  ·  бонус собран`); this.updateHud(); save(this.s); }

  tick() { for (const b of this.s.buildings) { if (b.kind === 'wood') this.s.wood += b.rate; else if (b.kind === 'stone') this.s.stone += b.rate; else if (b.kind === 'food') this.s.food += b.rate; else this.s.coins += b.rate; } this.updateHud(); save(this.s); }

  offline() { const sec = Math.min(3600, Math.max(0, Math.floor((Date.now() - this.s.lastSeen) / 1000))); if (sec > 20 && this.s.buildings.length) { let coins = 0, wood = 0, stone = 0, food = 0; for (const b of this.s.buildings) { if (b.kind === 'wood') wood += b.rate * sec; else if (b.kind === 'stone') stone += b.rate * sec; else if (b.kind === 'food') food += b.rate * sec; else coins += b.rate * sec; } this.s.coins += coins; this.s.wood += wood; this.s.stone += stone; this.s.food += food; this.flash(`Пока тебя не было — ресурсы накопились!`); this.updateHud(); } }

  gain(n: number) { this.s.xp += n; while (this.s.xp >= this.s.level * 100) { this.s.xp -= this.s.level * 100; this.s.level++; this.flash(`Новый уровень: ${this.s.level}!`); } this.updateHud(); }
  value(k: string) { return String(k === 'coin' ? this.s.coins : k === 'wood' ? this.s.wood : k === 'stone' ? this.s.stone : this.s.food); }
  updateHud() { for (const k of ['coin', 'wood', 'stone', 'food']) this.vals[k]?.setText(this.value(k)); this.vals.xp?.setText(`★ ${this.s.level}   ${this.s.xp}/${this.s.level * 100} XP`); this.quest?.setText(`ПОСТРОЙ 3 ЗДАНИЯ        ${this.s.quests.build}/3\nСОБЕРИ 50 РЕСУРСОВ      ${this.s.quests.gather}/50\nДОСТИГНИ 3 УРОВНЯ      ${Math.min(3, this.s.level)}/3`); }

  flash(msg: string) { this.toast?.destroy(); this.toast = this.add.text(400, 475, msg, { fontFamily: 'Trebuchet MS', fontSize: '16px', fontStyle: 'bold', color: '#503a2a', backgroundColor: '#fff0c8', padding: { x: 16, y: 10 } }).setOrigin(.5).setDepth(120); this.tweens.add({ targets: this.toast, y: 440, alpha: 0, duration: 1300, delay: 500, onComplete: () => this.toast?.destroy() }); }
  burst(x: number, y: number) { for (let i = 0; i < 12; i++) { const p = this.add.circle(x, y, Phaser.Math.Between(3, 5), i % 2 ? 0xffe18a : 0xffb95e).setDepth(100); this.tweens.add({ targets: p, x: x + Phaser.Math.Between(-58, 58), y: y + Phaser.Math.Between(-55, 8), alpha: 0, duration: 650 + i * 15, onComplete: () => p.destroy() }); } }
  panel(x: number, y: number, w: number, h: number, fill: number, stroke: number, line: number, parent?: Phaser.GameObjects.Container) { const g = this.add.graphics(); g.fillStyle(fill, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16); g.lineStyle(line, stroke, 1); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16); if (parent) parent.add(g); return g; }
  icon(k: string, x: number, y: number, parent: Phaser.GameObjects.Container) { const g = this.add.graphics(); g.fillStyle(0xfff9e8, 1); g.lineStyle(2, 0xd2b16d, 1); g.fillCircle(x, y, 19); if (k === 'coin') { g.fillStyle(0xe9ba43, 1); g.fillCircle(x, y, 9); g.fillStyle(0xffef9c, 1); g.fillCircle(x, y, 3); } else if (k === 'wood') { g.fillStyle(0x8d5c35, 1); g.fillRoundedRect(x - 10, y - 6, 20, 12, 5); } else if (k === 'stone') { g.fillStyle(0x89979e, 1); g.fillTriangle(x - 10, y + 8, x + 10, y + 5, x, y - 10); } else { g.fillStyle(0xe4a12f, 1); g.fillTriangle(x - 6, y + 9, x + 8, y + 9, x + 2, y - 10); } parent.add(g); }
  tree(x: number, y: number, s: number) { const g = this.add.graphics(); g.fillStyle(0x6a4b32, 1); g.fillRect(x - 5 * s, y + 8 * s, 10 * s, 30 * s); g.fillStyle(0x2e7142, 1); g.fillCircle(x, y, 22 * s); g.fillStyle(0x438c57, 1); g.fillCircle(x - 11 * s, y - 8 * s, 15 * s); g.fillCircle(x + 12 * s, y - 5 * s, 14 * s); g.fillStyle(0x6aaa60, 1); g.fillCircle(x - 4 * s, y - 14 * s, 8 * s); }
  flower(x: number, y: number, n: number) { const g = this.add.graphics(); g.fillStyle(0x568747, 1); g.fillRect(x, y, 2, 10); const c = n === 0 ? 0xffd16b : n === 1 ? 0xff90ae : 0xb9a0ee; g.fillStyle(c, 1); g.fillCircle(x, y, 4); g.fillCircle(x - 4, y + 2, 3); g.fillCircle(x + 4, y + 2, 3); g.fillStyle(0xfff1ae, 1); g.fillCircle(x, y + 2, 2); }
  rock(x: number, y: number, s: number) { const g = this.add.graphics(); g.fillStyle(0x899897, 1); g.fillEllipse(x, y, 25 * s, 16 * s); g.fillStyle(0xb9c1bc, 1); g.fillEllipse(x - 4 * s, y - 3 * s, 12 * s, 6 * s); }
}

new Phaser.Game({ type: Phaser.AUTO, width: 800, height: 600, parent: 'game', scene: GameScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true }, input: { activePointers: 2 } });
