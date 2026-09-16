import { CONFIG, CARS, STARTER_CAR_ID, getCarById } from '../config.js';
import { Storage } from '../utils/Storage.js';

// =========================================================
// StoreManager
// The whole coin economy and garage in one place: how many coins
// you have, which cars you own, which one you're driving, and what
// a finished run pays out.
//
// Everything is persisted through Storage (localStorage with safe
// fallbacks), so a blocked/unavailable localStorage degrades to a
// session-only garage instead of crashing the game.
// =========================================================

export class StoreManager {
  constructor() {
    this.coins = Storage.getCoins();

    // The starter car is always owned — this both bootstraps a brand new
    // save and repairs an old one whose owned-list somehow lost it.
    const owned = new Set(Storage.getOwnedCarIds());
    owned.add(STARTER_CAR_ID);
    // Drop ids that no longer exist in the catalog (e.g. a car was renamed
    // or removed in an update) so nothing downstream has to defend
    // against an unknown id.
    const validIds = new Set(CARS.map((c) => c.id));
    this.ownedIds = new Set([...owned].filter((id) => validIds.has(id)));

    const stored = Storage.getSelectedCarId();
    this.selectedId = this.ownedIds.has(stored) ? stored : STARTER_CAR_ID;

    this._persistGarage();
  }

  _persistGarage() {
    Storage.setOwnedCarIds([...this.ownedIds]);
    Storage.setSelectedCarId(this.selectedId);
  }

  // ---------- Coins ----------
  addCoins(amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!n) return this.coins;
    this.coins += n;
    Storage.setCoins(this.coins);
    return this.coins;
  }

  spendCoins(amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (n > this.coins) return false;
    this.coins -= n;
    Storage.setCoins(this.coins);
    return true;
  }

  // ---------- Garage ----------
  isOwned(id) { return this.ownedIds.has(id); }
  isSelected(id) { return this.selectedId === id; }

  getSelectedCar() { return getCarById(this.selectedId); }

  // Returns a view-model list for the store UI so the UI layer never has
  // to know about coins/ownership rules itself.
  getCatalogView() {
    return CARS.map((car) => ({
      ...car,
      owned: this.isOwned(car.id),
      selected: this.isSelected(car.id),
      affordable: this.coins >= car.price,
    }));
  }

  // Buy a car. Returns { ok, reason } so the UI can show why it failed.
  buy(id) {
    const car = CARS.find((c) => c.id === id);
    if (!car) return { ok: false, reason: 'unknown' };
    if (this.isOwned(id)) return { ok: false, reason: 'owned' };
    if (!this.spendCoins(car.price)) return { ok: false, reason: 'funds' };

    this.ownedIds.add(id);
    // Buying is an act of wanting to drive it, so equip immediately —
    // one tap instead of buy-then-select.
    this.selectedId = id;
    this._persistGarage();
    return { ok: true, car };
  }

  // Equip an already-owned car.
  select(id) {
    if (!this.isOwned(id)) return { ok: false, reason: 'locked' };
    this.selectedId = id;
    this._persistGarage();
    return { ok: true, car: getCarById(id) };
  }

  // ---------- Payouts ----------
  // Endless run reward. Returned as a broken-down list so the game-over
  // screen can show the player exactly where the coins came from.
  computeEndlessReward({ distance, levelReached, nearMisses, isNewBest }) {
    const lines = [];
    const dist = Math.floor((Math.max(0, distance) / 100) * CONFIG.COINS_PER_100M);
    if (dist > 0) lines.push({ label: 'Distance', amount: dist });

    const levels = Math.max(0, (levelReached || 1) - 1) * CONFIG.COINS_PER_LEVEL_CLEARED;
    if (levels > 0) lines.push({ label: 'Levels cleared', amount: levels });

    const misses = Math.max(0, Math.floor(nearMisses || 0)) * CONFIG.COINS_PER_NEAR_MISS;
    if (misses > 0) lines.push({ label: 'Near misses', amount: misses });

    if (isNewBest) lines.push({ label: 'New best!', amount: CONFIG.COINS_NEW_BEST_BONUS });

    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    return { total, lines };
  }

  computeRaceReward({ place, finished }) {
    const lines = [];
    if (!finished) {
      // Crashing out still pays a token amount so a wrecked race isn't a
      // total write-off, but nowhere near finishing.
      lines.push({ label: 'Did not finish', amount: Math.round(CONFIG.COINS_RACE_FINISH / 5) });
    } else if (place === 1) {
      lines.push({ label: '1st place', amount: CONFIG.COINS_RACE_WIN });
    } else if (place === 2 || place === 3) {
      lines.push({ label: 'Podium finish', amount: CONFIG.COINS_RACE_PODIUM });
    } else {
      lines.push({ label: 'Race finished', amount: CONFIG.COINS_RACE_FINISH });
    }
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    return { total, lines };
  }
}
