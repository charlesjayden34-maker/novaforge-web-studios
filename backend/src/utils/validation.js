const mongoose = require('mongoose');
const validator = require('validator');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ''));
}

function isSafeHttpUrl(value) {
  const input = String(value || '').trim();
  return validator.isURL(input, {
    require_protocol: true,
    protocols: ['http', 'https'],
    allow_protocol_relative_urls: false
  });
}

module.exports = { isValidObjectId, isSafeHttpUrl };
