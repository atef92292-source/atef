import Phaser from 'phaser';

const SAVE_KEY = 'domovik-usadba-v1';
type Save = { coins: number; wood: number; stone: number; xp: number; level: number; buildings: number; lastSeen: number };
const initial: Save = { coins: 80, wood: 40, stone: 20, xp: 0, level: 1, buildings: 0, lastSeen: Date.now() };

function load(): Save {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return { ...initial }; }
}
function save(s: Save) { s.lastSeen = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }

class GameScene extends Phaser.Scene {
  s = load();
  labels: Record<string, Phaser.GameObjects.Text> = {};

  constructor() { super('game'); }

  create() {
    this.cameras.main.setBackgroundColor('#dff3df');
    this.add.rectangle(400, 300, 800, 600, 0xdff3df);
    this.add.text(28, 24, 'ДОМОВИК: УСАДЬБА', { fontSize: '28px', color: '#23402b', fontStyle: 'bold' });
    this.add.text(30, 61, 'Построй уютную усадьбу и помоги домовому разбогатеть.', { fontSize: '16px', color: '#45634b' });

    this.makeText('coins', 30, 105, ''); this.makeText('wood', 30, 135, ''); this.makeText('stone', 30, 165, ''); this.makeText('level', 30, 195, '');
    this.updateHud();

    this.add.text(540, 100, 'ПОСТРОЙКИ', { fontSize: '20px', color: '#23402b', fontStyle: 'bold' });
    this.buildButton(540, 145, '🪵 Лесопилка', 50, () => this.build(50, 0, 1));
    this.buildButton(540, 210, '🪨 Каменоломня', 80, () => this.build(80, 20, 1));
    this.buildButton(540, 275, '🏡 Домик', 120, () => this.build(120, 40, 2));
    this.buildButton(540, 340, '✨ Мастерская', 200, () => this.build(200, 80, 3));

    this.add.text(30, 250, 'БЫСТРЫЕ ДЕЙСТВИЯ', { fontSize: '20px', color: '#23402b', fontStyle: 'bold' });
    this.actionButton(30, 295, 'Собрать дерево +10', () => { this.s.wood += 10; this.gainXp(5); this.flash('Получено дерево'); });
    this.actionButton(30, 355, 'Добыть камень +5', () => { this.s.stone += 5; this.gainXp(5); this.flash('Получен камень'); });
    this.actionButton(30, 415, 'Продать ресурсы', () => { const value = this.s.wood * 2 + this.s.stone * 3; this.s.coins += value; this.s.wood = 0; this.s.stone = 0; this.gainXp(10); this.flash(`Продано на ${value} монет`); });

    this.add.text(540, 430, 'ПРОГРЕСС', { fontSize: '20px', color: '#23402b', fontStyle: 'bold' });
    this.labels['buildings'] = this.add.text(540, 465, '', { fontSize: '18px', color: '#34543b' });
    this.labels['hint'] = this.add.text(540, 505, 'Совет: строй здания,\nчтобы быстрее получать XP.', { fontSize: '15px', color: '#56705b' });

    this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (this.s.buildings > 0) { this.s.coins += this.s.buildings; this.updateHud(); save(this.s); } } });
    save(this.s);
  }

  makeText(key: string, x: number, y: number, text: string) { this.labels[key] = this.add.text(x, y, text, { fontSize: '18px', color: '#23402b' }); }
  updateHud() {
    this.labels.coins.setText(`🪙 Монеты: ${this.s.coins}`); this.labels.wood.setText(`🪵 Дерево: ${this.s.wood}`); this.labels.stone.setText(`🪨 Камень: ${this.s.stone}`); this.labels.level.setText(`⭐ Уровень: ${this.s.level}  XP: ${this.s.xp}/${this.s.level * 100}`);
    this.labels.buildings?.setText(`Построек: ${this.s.buildings}`);
  }
  gainXp(n: number) { this.s.xp += n; while (this.s.xp >= this.s.level * 100) { this.s.xp -= this.s.level * 100; this.s.level++; this.flash(`Новый уровень: ${this.s.level}!`); } this.updateHud(); save(this.s); }
  build(cost: number, wood: number, xp: number) { if (this.s.coins < cost || this.s.wood < wood) { this.flash('Не хватает ресурсов'); return; } this.s.coins -= cost; this.s.wood -= wood; this.s.buildings++; this.gainXp(xp * 20); this.flash('Постройка завершена!'); }
  buildButton(x: number, y: number, title: string, cost: number, fn: () => void) { const b = this.add.rectangle(x + 115, y + 22, 230, 46, 0xffffff).setStrokeStyle(2, 0x9eb8a2).setInteractive({ useHandCursor: true }); this.add.text(x + 12, y + 8, title, { fontSize: '16px', color: '#23402b' }); this.add.text(x + 150, y + 10, `${cost} 🪙`, { fontSize: '15px', color: '#76551f' }); b.on('pointerdown', fn); }
  actionButton(x: number, y: number, title: string, fn: () => void) { const b = this.add.rectangle(x + 150, y + 22, 300, 46, 0xf7fff5).setStrokeStyle(2, 0x9eb8a2).setInteractive({ useHandCursor: true }); this.add.text(x + 18, y + 9, title, { fontSize: '16px', color: '#23402b' }); b.on('pointerdown', () => { fn(); save(this.s); }); }
  flash(msg: string) { const t = this.add.text(400, 555, msg, { fontSize: '20px', color: '#23402b', backgroundColor: '#ffffff', padding: { x: 14, y: 8 } }).setOrigin(.5); this.tweens.add({ targets: t, alpha: 0, y: 525, duration: 900, onComplete: () => t.destroy() }); }
}

new Phaser.Game({ type: Phaser.AUTO, width: 800, height: 600, parent: 'game', backgroundColor: '#dff3df', scene: GameScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
