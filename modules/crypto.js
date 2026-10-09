const crypto = require('crypto')

function encrypt(value) {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.CLIENT_SECRET_HASH), iv)
    let encrypted = cipher.update(value, 'utf-8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
}

function decrypt(value) {
    const parts = value.split(':')
    const iv = Buffer.from(parts.shift(), 'hex')
    const encryptedData = parts.join(':')
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(process.env.CLIENT_SECRET_HASH), iv)
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

module.exports = { encrypt, decrypt }