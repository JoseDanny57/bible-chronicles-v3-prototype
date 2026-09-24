import { auth, db, FieldValue, WEB_API_KEY, SESSION_MS, publicProfile, requireSession, setSessionCookie, clearSessionCookie, json, method, sameOrigin } from './_firebase.js';

const body=req=>typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim().toLowerCase());

async function passwordSignIn(email,password){
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:true})
  });
  const data=await r.json();
  if(!r.ok||!data.idToken) throw Object.assign(new Error('INVALID_CREDENTIALS'),{status:401});
  return data;
}
async function issueSession(res,idToken){
  const cookie=await auth().createSessionCookie(idToken,{expiresIn:SESSION_MS});
  setSessionCookie(res,cookie);
}
async function getProfile(uid){
  const snap=await db().collection('users').doc(uid).get();
  return snap.exists?publicProfile(snap.data(),uid):null;
}
function sanitizeGameState(input={}){
  const out={updatedAt:FieldValue.serverTimestamp()};
  if(input.traveler===null||(input.traveler&&typeof input.traveler==='object')) out.traveler=input.traveler;
  if(Number.isFinite(Number(input.score))) out.score=Math.max(0,Number(input.score));
  if(Array.isArray(input.inventory)) out.inventory=input.inventory.slice(0,250);
  if(Array.isArray(input.journal)) out.journal=input.journal.slice(0,500);
  if(input.progress===null||typeof input.progress==='object'||typeof input.progress==='string') out.progress=input.progress;
  if(input.currentScreen) out.currentScreen=String(input.currentScreen).slice(0,100);
  return out;
}

export default async function handler(req,res){
  const action=String(req.query?.action||'session');
  if(!sameOrigin(req)){ json(res,403,{error:'ORIGIN_REJECTED'}); return; }
  try{
    if(action==='session'){
      if(!method(req,res,['GET'])) return;
      const decoded=await requireSession(req);
      const profile=await getProfile(decoded.uid);
      if(!profile) throw Object.assign(new Error('PROFILE_NOT_FOUND'),{status:404});
      json(res,200,{profile}); return;
    }
    if(action==='register'){
      if(!method(req,res,['POST'])) return;
      const {name='',email='',password=''}=body(req);
      const cleanEmail=String(email).trim().toLowerCase();
      const cleanName=String(name).trim().slice(0,40);
      if(!validEmail(cleanEmail)) throw Object.assign(new Error('INVALID_EMAIL'),{status:400});
      if(String(password).length<6) throw Object.assign(new Error('WEAK_PASSWORD'),{status:400});
      let user;
      try{
        user=await auth().createUser({email:cleanEmail,password:String(password),displayName:cleanName||undefined});
      }catch(e){
        if(e.code==='auth/email-already-exists') throw Object.assign(new Error('EMAIL_TAKEN'),{status:409});
        throw e;
      }
      try{
        await db().collection('users').doc(user.uid).set({
          name:cleanName,
          role:'player',
          traveler:null,
          score:0,
          inventory:[],
          journal:[],
          progress:null,
          currentScreen:'viajeros.html',
          schemaVersion:3,
          createdAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp()
        });
      }catch(e){
        await auth().deleteUser(user.uid).catch(()=>{});
        throw e;
      }
      const signIn=await passwordSignIn(cleanEmail,password);
      await issueSession(res,signIn.idToken);
      json(res,201,{profile:await getProfile(user.uid)}); return;
    }
    if(action==='login'){
      if(!method(req,res,['POST'])) return;
      const {email='',password=''}=body(req);
      const cleanEmail=String(email).trim().toLowerCase();
      if(!validEmail(cleanEmail)) throw Object.assign(new Error('INVALID_CREDENTIALS'),{status:401});
      const signIn=await passwordSignIn(cleanEmail,String(password));
      await issueSession(res,signIn.idToken);
      const user=await auth().getUserByEmail(cleanEmail);
      let profile=await getProfile(user.uid);
      if(!profile){
        await db().collection('users').doc(user.uid).set({
          name:user.displayName||'',
          role:'player',
          traveler:null,
          score:0,
          inventory:[],
          journal:[],
          progress:null,
          currentScreen:'viajeros.html',
          schemaVersion:3,
          createdAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp()
        },{merge:true});
        profile=await getProfile(user.uid);
      }
      json(res,200,{profile}); return;
    }
    if(action==='save'){
      if(!method(req,res,['POST'])) return;
      const decoded=await requireSession(req);
      await db().collection('users').doc(decoded.uid).set(sanitizeGameState(body(req)),{merge:true});
      json(res,200,{profile:await getProfile(decoded.uid)}); return;
    }
    if(action==='logout'){
      if(!method(req,res,['POST'])) return;
      clearSessionCookie(res);
      json(res,200,{ok:true}); return;
    }
    if(action==='recover'){
      if(!method(req,res,['POST'])) return;
      const {email=''}=body(req),clean=String(email).trim().toLowerCase();
      if(validEmail(clean)){
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY}`,{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({requestType:'PASSWORD_RESET',email:clean})
        }).catch(()=>{});
      }
      json(res,200,{ok:true}); return;
    }
    json(res,404,{error:'UNKNOWN_ACTION'});
  }catch(e){
    const status=e.status||500;
    const known=['INVALID_CREDENTIALS','INVALID_EMAIL','WEAK_PASSWORD','EMAIL_TAKEN','UNAUTHENTICATED','PROFILE_NOT_FOUND','FIREBASE_ADMIN_NOT_CONFIGURED'];
    json(res,status,{error:known.includes(e.message)?e.message:'SERVER_ERROR'});
  }
}