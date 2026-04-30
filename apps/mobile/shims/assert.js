function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}

module.exports = assert;
module.exports.default = assert;
