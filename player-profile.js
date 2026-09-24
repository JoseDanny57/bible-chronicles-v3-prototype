(()=>{
  const PROFILE_KEY='bibleChroniclesV3Profile';
  let current=null;
  let readyPromise=null;
  const read=()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY))||null}catch{return null}};
  const write=p=>{current=p||null;if(p)localStorage.setItem(PROFILE_KEY,JSON.stringify(p));else localStorage.removeItem(PROFILE_KEY)};
  const getActive=()=>current||read();

  async function api(action,options={}){
    const r=await fetch('/api/account?action='+encodeURIComponent(action),{
      credentials:'same-origin',
      headers:{'content-type':'application/json',...(options.headers||{})},
      ...options
    });
    let data={};try{data=await r.json()}catch{}
    if(!r.ok){
      const map={
        INVALID_CREDENTIALS:'Correo o contraseña incorrectos.',
        INVALID_EMAIL:'Escribe un correo electrónico válido.',
        WEAK_PASSWORD:'La contraseña debe tener al menos 6 caracteres.',
        EMAIL_TAKEN:'Ese correo ya está registrado.',
        UNAUTHENTICATED:'La sesión no está activa.',
        PROFILE_NOT_FOUND:'No se encontró el perfil del jugador.',
        FIREBASE_ADMIN_NOT_CONFIGURED:'Firebase aún no está conectado a este proyecto de Vercel.'
      };
      throw new Error(map[data.error]||'No se pudo completar la operación.');
    }
    return data;
  }

  async function ready(){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      try{const data=await api('session',{method:'GET',headers:{}});write(data.profile);return data.profile}
      catch{write(null);return null}
    })();
    return readyPromise;
  }
  async function createPlayer(name,email,password){
    const data=await api('register',{method:'POST',body:JSON.stringify({name:(name||'').trim(),email:(email||'').trim(),password})});
    write(data.profile);readyPromise=Promise.resolve(data.profile);return data.profile;
  }
  async function login(email,password){
    const data=await api('login',{method:'POST',body:JSON.stringify({email:(email||'').trim(),password})});
    write(data.profile);readyPromise=Promise.resolve(data.profile);return data.profile;
  }
  async function recover(email){await api('recover',{method:'POST',body:JSON.stringify({email:(email||'').trim()})});return true}
  async function logout(){try{await api('logout',{method:'POST',body:'{}'})}finally{write(null);readyPromise=null}}
  async function save(extra={}){const p=getActive();if(!p)return null;const data=await api('save',{method:'POST',body:JSON.stringify(extra)});write(data.profile);return data.profile}
  current=read();
  window.BibleChroniclesPlayer={ready,createPlayer,login,recover,logout,save,getActive};
})();