(()=>{
  const SETTINGS_KEY='bc-v3-settings';
  const defaults={sound:true,music:true};

  function loadSettings(){
    try{
      return {...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};
    }catch{
      return {...defaults};
    }
  }

  let settings=loadSettings();

  function saveSettings(){
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
  }

  async function requestGameFullscreen(){
    const mobile=matchMedia('(max-width: 1024px)').matches;
    const landscape=matchMedia('(orientation: landscape)').matches;
    if(!mobile||!landscape)return false;
    const root=document.documentElement;
    try{
      if(!document.fullscreenElement&&root.requestFullscreen){
        await root.requestFullscreen({navigationUI:'hide'});
      }
      if(screen.orientation&&screen.orientation.lock){
        try{await screen.orientation.lock('landscape')}catch{}
      }
      return !!document.fullscreenElement;
    }catch{
      return false;
    }
  }

  function getSetting(name,fallback){
    return Object.prototype.hasOwnProperty.call(settings,name)?settings[name]:fallback;
  }

  function setSetting(name,value){
    settings={...settings,[name]:value};
    saveSettings();
    window.dispatchEvent(new CustomEvent('bc:settings',{detail:{...settings}}));
  }

  window.BCApp={
    getSetting,
    setSetting,
    requestGameFullscreen
  };

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    });
  }
})();