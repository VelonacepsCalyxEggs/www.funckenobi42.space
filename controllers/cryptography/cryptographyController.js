const crypto = require('crypto');

exports.hashPassword= async (password, salt, iterations, keylen, digest) => {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'), salt);
      });
    }); 
}

exports.encodeName = async (name) => {
    const encodedName = Buffer.from(name, 'utf-8').toString('base64');
    return encodedName;
}

exports.generateToken = async () => {
    return crypto.randomBytes(20).toString('hex');
}
