// Proxy para CSS Modules: retorna o nome da classe como string.
// Ex: styles.badge → "badge"
module.exports = new Proxy(
  {},
  {
    get: function (_target, key) {
      if (key === "__esModule") return true;
      return String(key);
    },
  }
);
