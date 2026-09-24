import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'bible-chronicles';
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyAfnJUhW5hXDg6Pm1FzrWGn4X4eSn9clBs';
const COOKIE_NAME = 'bc_v3_session';
const SESSION_MS = 5 * 24 * 60 * 60 * 1000;

function credentialFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return cert(parsed);
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return null;
  return cert({ projectId: PROJECT_ID, clientEmail, privateKey });
}

function app() {
  if (getApps().length) return getApps()[0];
  const credential = credentialFromEnv();
  if (!credential) throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  return initializeApp({ credential, projectId: PROJECT_ID });
}

export function auth(){ return getAuth(app()); }
export function db(){ return getFirestore(app()); }
export { FieldValue, WEB_API_KEY, COOKIE_NAME, SESSION_MS };

export function publicProfile(data = {}, uid = '') {
  return {
    uid,
    name: data.name || '',
    role: data.role || 'player',
    traveler: data.traveler || null,
    score: Number(data.score || 0),
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    journal: Array.isArray(data.journal) ? data.journal : [],
    progress: data.progress ?? null,
    currentScreen: data.currentScreen || 'viajeros.html',
    schemaVersion: Number(data.schemaVersion || 3)
  };
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{
    const i=v.indexOf('=');
    return [decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))];
  }));
}

export async function requireSession(req) {
  const token=parseCookies(req)[COOKIE_NAME];
  if(!token) throw Object.assign(new Error('UNAUTHENTICATED'),{status:401});
  try { return await auth().verifySessionCookie(token,true); }
  catch { throw Object.assign(new Error('UNAUTHENTICATED'),{status:401}); }
}

export function setSessionCookie(res,cookie){
  res.setHeader('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(cookie)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS/1000)}`);
}
export function clearSessionCookie(res){
  res.setHeader('Set-Cookie',`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export function json(res,status,body){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8').send(JSON.stringify(body));
}
export function method(req,res,allowed=['POST']){
  if(!allowed.includes(req.method)){
    res.setHeader('Allow',allowed.join(', '));
    json(res,405,{error:'METHOD_NOT_ALLOWED'});
    return false;
  }
  return true;
}
export function sameOrigin(req){
  const origin=req.headers.origin;
  if(!origin) return true;
  try { return new URL(origin).host===req.headers.host; } catch { return false; }
}