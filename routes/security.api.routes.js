const Router=require('express').Router();
const crypto=require('crypto');
const mongoose=require('mongoose');
const OTPAuth=require('otpauth');
const QRCode=require('qrcode');
const {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse}=require('@simplewebauthn/server');
const Security=require('../models/Security');
const Challenge=require('../models/SecurityChallenge');
const User=require('../models/User');
const {verifyPortalToken,issueSession,hashToken}=require('../modules/auth/session');
const security=require('../modules/auth/security');
const {rateLimit}=require('express-rate-limit');
Router.use(rateLimit({windowMs:60000,limit:30,message:{success:false,message:'Too many security attempts. Wait a minute before trying again.'},standardHeaders:'draft-8',legacyHeaders:false}));
Router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const route=handler=>async(req,res)=>{try{await handler(req,res);}catch{res.status(400).json({success:false,message:'Security verification failed. Start again or check server configuration.'});}};
const need= (condition,res,message='Verification failed.')=>{if(!condition){res.status(400).json({success:false,message});return false;}return true;};

Router.post('/totp/setup',verifyPortalToken,route(async(req,res)=>{
    if(await security.enabled(req.user.id))return res.status(409).json({success:false,message:'An authenticator is already enabled. Remove it before replacing it.'});
    const user=await User.findById(req.user.id);
    if(!await security.stepUp(user,req))return res.status(403).json({success:false,message:'Confirm your current password or verify an existing passkey.'});
    const secret=new OTPAuth.Secret({size:20});const totp=new OTPAuth.TOTP({issuer:'Auth Central',label:user.email,algorithm:'SHA1',digits:6,period:30,secret});
    const token=await security.challenge(user.id,'totp-setup',{sessionId:req.session._id,encryptedSecret:security.seal(secret.base32)});
    res.json({success:true,data:{token,uri:totp.toString(),qr:await QRCode.toDataURL(totp.toString()),secret:secret.base32}});
}));
Router.post('/totp/confirm',verifyPortalToken,route(async(req,res)=>{
    const pending=await security.take(req.body.token,'totp-setup',{userId:req.user.id,sessionId:req.session._id});if(!need(pending,res,'Setup expired or already used. Start again.'))return;
    const secret=security.open(pending.encryptedSecret),totp=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(secret)});const delta=totp.validate({token:String(req.body.code),window:1});if(!need(delta!==null,res,'Invalid authenticator code. Start setup again.'))return;
    const recovery=Array.from({length:8},()=>crypto.randomBytes(8).toString('hex'));
    await Security.updateOne({userId:req.user.id},{$setOnInsert:{userId:req.user.id}},{upsert:true});
    const result=await Security.updateOne({userId:req.user.id,'totp.enabled':{$ne:true}},{$set:{totp:{enabled:true,encryptedSecret:security.seal(secret),lastStep:Math.floor(Date.now()/30000)+delta,recoveryHashes:recovery.map(hashToken)}}},{upsert:false});
    if(!result.matchedCount)return res.status(409).json({success:false,message:'Authenticator state changed. Reload.'});
    res.json({success:true,message:'Authenticator enabled. Save the recovery codes now.',data:{recoveryCodes:recovery}});
}));
Router.post('/totp/remove',verifyPortalToken,route(async(req,res)=>{
    if(!await security.verifyCode(req.user.id,req.body.code))return res.status(403).json({success:false,message:'Enter a current authenticator code or unused recovery code.'});
    await Security.updateOne({userId:req.user.id},{$set:{totp:{enabled:false,lastStep:-1}}});res.json({success:true,message:'Authenticator removed.'});
}));
Router.post('/login/totp',route(async(req,res)=>{
    const token=req.cookies.pendingMfa || req.body.token;
    const pending=typeof token==='string' ? await Challenge.findOneAndUpdate({tokenHash:hashToken(token),kind:'login-totp',usedAt:null,expiresAt:{$gt:new Date()},attempts:{$lt:5}},{$inc:{attempts:1}},{returnDocument:'after'}) : null;
    if(!need(pending,res,'Sign-in challenge expired. Sign in again.'))return;
    const user=await User.findById(pending.userId);if(!need(user?.status==='active'&&user.emailVerifiedAt,res))return;
    if(!await security.verifyCode(user.id,req.body.code))return res.status(403).json({success:false,message:'Invalid, used or expired authenticator/recovery code.'});
    const consumed=await Challenge.updateOne({_id:pending._id,usedAt:null},{$set:{usedAt:new Date()}});if(!need(consumed.modifiedCount,res))return;
    res.clearCookie('pendingMfa',{path:'/'});const tokens=await issueSession(user,req,res,'login');res.json({success:true,accessToken:tokens.accessToken,redirectURL:pending.redirect || '/dashboard'});
}));
Router.post('/passkeys/register/options',verifyPortalToken,route(async(req,res)=>{
    const user=await User.findById(req.user.id);if(!await security.stepUp(user,req))return res.status(403).json({success:false,message:'Confirm your password, authenticator code or existing passkey.'});
    const record=await Security.findOne({userId:user.id});if((record?.passkeys?.length||0)>=10)return res.status(409).json({success:false,message:'A maximum of 10 passkeys is allowed.'});
    const {rpID}=security.rp();const options=await generateRegistrationOptions({rpName:'Auth Central',rpID,userID:new Uint8Array(Buffer.from(user.id)),userName:user.email,attestationType:'none',excludeCredentials:(record?.passkeys||[]).map(k=>({id:k.credentialId,transports:k.transports})),authenticatorSelection:{residentKey:'preferred',userVerification:'required'}});
    const token=await security.challenge(user.id,'passkey-register',{sessionId:req.session._id,challenge:options.challenge});res.json({success:true,data:{options,token}});
}));
Router.post('/passkeys/register/verify',verifyPortalToken,route(async(req,res)=>{
    const pending=await security.take(req.body.token,'passkey-register',{userId:req.user.id,sessionId:req.session._id});if(!need(pending,res))return;
    const {rpID,origin}=security.rp();const verified=await verifyRegistrationResponse({response:req.body.response,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});if(!need(verified.verified,res))return;
    const c=verified.registrationInfo.credential;if(await Security.exists({'passkeys.credentialId':c.id}))return res.status(409).json({success:false,message:'Passkey already registered.'});
    await Security.updateOne({userId:req.user.id},{$push:{passkeys:{credentialId:c.id,publicKey:Buffer.from(c.publicKey).toString('base64url'),counter:c.counter,transports:c.transports||[],name:String(req.body.name||'Passkey').slice(0,64),createdAt:new Date()}}},{upsert:true});res.json({success:true,message:'Passkey registered.'});
}));
Router.post('/passkeys/authenticate/options',route(async(req,res)=>{
    const user=await User.findOne({email:String(req.body.email||'').trim().toLowerCase(),status:'active'});if(!user?.emailVerifiedAt)return res.status(400).json({success:false,message:'Passkey sign-in is not available for this account.'});
    const record=await Security.findOne({userId:user.id});if(!record?.passkeys?.length)return res.status(400).json({success:false,message:'Passkey sign-in is not available for this account.'});
    const {rpID}=security.rp();const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:record.passkeys.map(k=>({id:k.credentialId,transports:k.transports}))});
    const token=await security.challenge(user.id,'passkey-authenticate',{challenge:options.challenge});res.json({success:true,data:{options,token}});
}));
Router.post('/passkeys/authenticate/verify',route(async(req,res)=>{
    const pending=await security.take(req.body.token,'passkey-authenticate');if(!need(pending,res))return;
    const user=await User.findById(pending.userId);if(!need(user?.status==='active'&&user.emailVerifiedAt,res))return;
    const record=await Security.findOne({userId:user.id}),credential=record?.passkeys.find(k=>k.credentialId===req.body.response?.id);if(!need(credential,res))return;
    const {rpID,origin}=security.rp();const result=await verifyAuthenticationResponse({response:req.body.response,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:credential.credentialId,publicKey:new Uint8Array(Buffer.from(credential.publicKey,'base64url')),counter:credential.counter,transports:credential.transports}});if(!need(result.verified,res))return;
    const updated=await Security.updateOne({_id:record._id,passkeys:{$elemMatch:{credentialId:credential.credentialId,counter:credential.counter}}},{$set:{'passkeys.$.counter':result.authenticationInfo.newCounter}});if(!need(updated.matchedCount,res))return;
    const current=req.cookies.refreshToken ? await require('../models/Session').findOne({refreshToken:hashToken(req.cookies.refreshToken),userId:user.id,appId:null,revokedAt:null,expiresAt:{$gt:new Date()}}) : null;
    if(req.body.stepUp&&current){const proof=await security.challenge(user.id,'step-up',{sessionId:current._id});return res.json({success:true,data:{proof}});}
    if(await security.enabled(user.id)){const token=await security.beginLogin(user,req,res);return res.json({success:false,mfaRequired:true,data:{token},message:'Enter your authenticator or recovery code.'});}
    const tokens=await issueSession(user,req,res,'login');res.json({success:true,accessToken:tokens.accessToken,redirectURL:'/dashboard'});
}));
Router.post('/passkeys/:id/remove',verifyPortalToken,route(async(req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({success:false,message:'Invalid passkey.'});
    const user=await User.findById(req.user.id);if(!await security.stepUp(user,req))return res.status(403).json({success:false,message:'Confirm a current password, authenticator code or passkey.'});
    const record=await Security.findOne({userId:user.id});const stored=await User.findById(user.id).select('+password');if(!stored.password&&(record?.passkeys?.length||0)<=1)return res.status(409).json({success:false,message:'Keep at least one passkey or set a password before removing the last passkey.'});
    const result=await Security.updateOne({userId:user.id,'passkeys._id':req.params.id},{$pull:{passkeys:{_id:req.params.id}}});res.status(result.modifiedCount?200:404).json({success:Boolean(result.modifiedCount),message:result.modifiedCount?'Passkey removed.':'Passkey not found.'});
}));
module.exports=Router;
