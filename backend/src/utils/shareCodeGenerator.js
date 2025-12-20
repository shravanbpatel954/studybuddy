const crypto = require('crypto');

function generateShareCode(length = 6) {
    // Characters: uppercase, lowercase, digits
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        // Map byte to an index within chars length
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

module.exports = { generateShareCode };