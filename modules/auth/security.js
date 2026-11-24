const crypto = require('crypto');
const bcrypt = require('bcrypt');
const OTPAuth = require('otpauth');
const Security = require('../../models/Security');
const Challenge = require('../../models/SecurityChallenge');
const { hashToken, issueSession } = require('../auth/session');

function key() { return crypto.createHash('sha256').update(process.env.CLIENT_SECRET_HASH).digest(); }
function seal(value) { const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64url')).join('.'); }
function open(value) { const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64url'));const cipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8'); }
async function challenge(userId,kind,extra={}) { const token=crypto.randomBytes(32).toString('base64url');await Challenge.create({userId,kind,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+300000),...extra});return token; }
async function take(token,kind,extra={}) { if(typeof token!=='string'||token.length>128)return null;return Challenge.findOneAndUpdate({tokenHash:hashToken(token),kind,usedAt:null,expiresAt:{$gt:new Date()},attempts:{$lt:5},...extra},{$set:{usedAt:new Date()}},{returnDocument:'after'}).select('+encryptedSecret'); }
async function verifyCode(userId,code) {
    if(typeof code!=='string'||code.length>64)return false;
    const record=await Security.findOne({userId}).select('+totp.encryptedSecret +totp.recoveryHashes');
    if(!record?.totp?.enabled)return false;
    if(/^\d{6}$/.test(code)) {
        const totp=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(open(record.totp.encryptedSecret)),algorithm:'SHA1',digits:6,period:30});
        const delta=totp.validate({token:code,window:1});
        if(delta===null)return false;
        const step=Math.floor(Date.now()/30000)+delta;
        const result=await Security.updateOne({_id:record._id,'totp.enabled':true,'totp.lastStep':{$lt:step}},{$set:{'totp.lastStep':step}});
        return Boolean(result.modifiedCount);
    }
    const digest=hashToken(code.toLowerCase().replace(/\s/g,''));
    const result=await Security.updateOne({_id:record._id,'totp.enabled':true,'totp.recoveryHashes':digest},{$pull:{'totp.recoveryHashes':digest}});
    return Boolean(result.modifiedCount);
}
async function enabled(userId) { return Boolean(await Security.exists({userId,'totp.enabled':true})); }
async function beginLogin(user,req,res,redirect='/dashboard') { const token=await challenge(user._id,'login-totp',{redirect});res.cookie('pendingMfa',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:300000});return token; }
async function stepUp(user,req) {
    const SecurityRecord=await Security.findOne({userId:user._id});
    if(SecurityRecord?.totp?.enabled)return verifyCode(user._id,req.body.code);
    const stored=await require('../../models/User').findById(user._id).select('+password');
    if(stored?.password&&typeof req.body.password==='string')return bcrypt.compare(req.body.password,stored.password);
    const proof=await take(req.body.proof,'step-up',{userId:user._id,sessionId:req.session._id});
    return Boolean(proof);
}
function rp() { const origin=process.env.WEBAUTHN_ORIGIN || (process.env.NODE_ENV==='production' ? '' : 'http://localhost:3000');if(!origin)throw Error('Set WEBAUTHN_ORIGIN');const url=new URL(origin);if(url.origin!==origin||(url.protocol!=='https:'&&url.hostname!=='localhost'))throw Error('Invalid WebAuthn origin');return {origin,rpID:url.hostname}; }
module.exports={seal,open,challenge,take,verifyCode,enabled,beginLogin,stepUp,rp};
