// expo-sqlite's key-value store needs its native database; Jest gets a map per database name.
class SQLiteStorage {
  constructor() {
    this.held = new Map();
  }
  getItemSync(key) {
    return this.held.has(key) ? this.held.get(key) : null;
  }
  setItemSync(key, value) {
    this.held.set(key, value);
  }
  removeItemSync(key) {
    return this.held.delete(key);
  }
}

module.exports = { SQLiteStorage };
