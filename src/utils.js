const crypto = require('crypto');

/**
 * Escapes HTML characters to prevent XSS attacks.
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

/**
 * Generates a SHA-256 hash checksum of a JSON object/string.
 * @param {object|string} data
 * @returns {string} Hex hash string (first 12 chars)
 */
function generateChecksum(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

module.exports = {
  escapeHtml,
  generateChecksum,
};
