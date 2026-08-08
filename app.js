const $=s=>document.querySelector(s);
let db,notes=[],filter="all",current=null,recording=false,rec=null,stream=null,recognition=null,transcript="",chunks=[],timerId=null,seconds=0,pressTimer=null,audio=null;
const DB="VoiceAssistantDB",STORE="notes";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function openDB(){return new Promise((resolve,reject)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id"});r.onsuccess=()=>{db=r.result;resolve()};r.onerror=()=>reject(r.error)})}
function getAll(){return new Promise((res,rej)=>{let r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result.sort((a,b)=>b.id-a.id));r.onerror=()=>rej(r.error)})}
function put(n){return new Promise((res,rej)=>{let r=db.transaction(STORE,"readwrite").objectStore(STORE).put(n);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function del(id){return new Promise((res,rej)=>{let r=db.transaction(STORE,"readwrite").objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function fmt(s){s=Math.max(0,Math.floor(s||0));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function titleFrom(t){let w=t.replace(/[.!?,]/g,"").split(/\s+/).filter(Boolean);return w.length?w.slice(0,7).join(" ").replace(/^./,c=>c.toUpperCase()):"Новая заметка"}
function show(x){x.classList.add("active")}function hide(x){x.classList.remove("active")}
function msg(s){let t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function render(){let q=$("#search").value.toLowerCase();let arr=notes.filter(n=>(filter==="fav"?n.favorite:filter==="task"?n.text.includes("надо")||n.text.includes("нужно")||n.text.includes("купить"):true)&&(`${n.title} ${n.text}`).toLowerCase().includes(q));$("#count").textContent=arr.length+" замет"+(arr.length===1?"ка":arr.length<5?"ки":"ок");$("#notes").innerHTML=arr.length?arr.map(n=>`<article class="note" data-id="${n.id}"><div class="note-row"><h3>${esc(n.title)}</h3><button class="star ${n.favorite?"on":""}" data-star="${n.id}">${n.favorite?"★":"☆"}</button></div><p>${esc(n.text).slice(0,170)}${n.text.length>170?"…":""}</p><div class="note-footer"><span>${esc(n.date)}</span>${n.audio?`<span class="audio-pill">▶ ${fmt(n.duration||0)}</span>`:""}</div></article>`).join(""):`<div class="empty"><div class="big">🎙</div><b>Заметок пока нет</b>Зажмите микрофон и скажите первую мысль.`;document.querySelectorAll(".note").forEach(x=>x.onclick=e=>{if(e.target.closest("[data-star]"))return;openNote(+x.dataset.id)});document.querySelectorAll("[data-star]").forEach(b=>b.onclick=async e=>{e.stopPropagation();let n=notes.find(x=>x.id==b.dataset.star);n.favorite=!n.favorite;await put(n);notes=await getAll();render()})}
function setupWave(){let w=$("#wave");w.innerHTML="";for(let i=0;i<25;i++){let e=document.createElement("i");w.appendChild(e)}}
async function begin(){if(recording)return;recording=true;chunks=[];transcript="";seconds=0;$("#fab").classList.add("recording");$("#recordPanel").classList.add("live");$("#recordStatus").textContent="Слушаю…";$("#recordHint").textContent="Говорите свободно";$("#liveText").textContent="Слушаю…";$("#timer").textContent="00:00";timerId=setInterval(()=>{$("#timer").textContent=fmt(++seconds)},1000);
try{stream=await navigator.mediaDevices.getUserMedia({audio:true});let mime=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":(MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"");rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.start()}catch(e){finish("Нет доступа к микрофону");return}
const S=window.SpeechRecognition||window.webkitSpeechRecognition;if(S){recognition=new S();recognition.lang="ru-RU";recognition.continuous=true;recognition.interimResults=true;recognition.onresult=e=>{let s="";for(let i=0;i<e.results.length;i++)s+=e.results[i][0].transcript+" ";transcript=s.trim();$("#liveText").textContent=transcript||"Слушаю…"};recognition.onerror=e=>console.log("speech",e.error);try{recognition.start()}catch(e){}}else $("#recordHint").textContent="Запись идёт; этот браузер не дал распознавание речи"}
async function finish(error=""){
  clearInterval(timerId);
  timerId=null;
  try{recognition?.stop()}catch(e){}
  recognition=null;
  if(rec&&rec.state!=="inactive")rec.stop();
  stream?.getTracks().forEach(t=>t.stop());
  stream=null;
  await new Promise(r=>setTimeout(r,80));
  recording=false;
  rec=null;
  $("#fab").classList.remove("recording","pressing");
  $("#recordPanel").classList.remove("live");
  if(error){msg(error);return}
  let blob=chunks.length?new Blob(chunks,{type:rec?.mimeType||"audio/mp4"}):null;
  let text=transcript.trim()||"Голосовая заметка без расшифровки.";
  let n={id:Date.now(),title:titleFrom(text),text,date:"Сегодня, "+new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}),favorite:false,audioBlob:blob,duration:seconds};
  await put(n);notes=await getAll();render();msg("Сохранено: текст + аудио");$("#liveText").textContent=text;
}

// iPhone/Safari: if the PWA is sent to the background, immediately release the microphone.
async function stopOnBackground(){
  if(recording) await finish("Запись остановлена: приложение свернуто");
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")stopOnBackground()});
window.addEventListener("pagehide",()=>{if(recording){try{recognition?.stop()}catch(e){};stream?.getTracks().forEach(t=>t.stop())}});
window.addEventListener("blur",()=>{if(recording && document.visibilityState==="hidden")stopOnBackground()});

function openNote(id){current=notes.find(n=>n.id===id);if(!current)return;$("#title").value=current.title;$("#text").value=current.text;$("#date").textContent=current.date;$("#favorite").textContent=current.favorite?"★ Избранное":"☆ Избранное";$("#player").classList.toggle("hidden",!current.audioBlob);if(current.audioBlob){if(audio)URL.revokeObjectURL(audio.src);audio=new Audio(URL.createObjectURL(current.audioBlob));audio.ontimeupdate=()=>{$("#playTime").textContent=fmt(audio.currentTime);$("#seek").value=audio.duration?(audio.currentTime/audio.duration*100):0};audio.onloadedmetadata=()=>{$("#duration").textContent=fmt(audio.duration)}}show($("#noteScreen"))}
$("#play").onclick=()=>{if(!audio)return;if(audio.paused){audio.play();$("#play").textContent="❚❚"}else{audio.pause();$("#play").textContent="▶"}};$("#seek").oninput=e=>{if(audio&&audio.duration)audio.currentTime=audio.duration*e.target.value/100};
$("#save").onclick=async()=>{current.title=$("#title").value.trim()||"Без названия";current.text=$("#text").value.trim();await put(current);notes=await getAll();render();msg("Сохранено")};
$("#favorite").onclick=async()=>{current.favorite=!current.favorite;$("#favorite").textContent=current.favorite?"★ Избранное":"☆ Избранное";await put(current);notes=await getAll();render()};
$("#delete").onclick=async()=>{if(confirm("Удалить заметку?")){await del(current.id);notes=await getAll();render();hide($("#noteScreen"));msg("Удалено")}};
$("#noteBack").onclick=()=>hide($("#noteScreen"));$("#settingsBtn").onclick=()=>show($("#settingsScreen"));$("#settingsBack").onclick=()=>hide($("#settingsScreen"));$("#favNav").onclick=()=>{filter="fav";document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));document.querySelector('[data-filter="fav"]').classList.add("active");render()};
document.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{filter=c.dataset.filter;document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");render()});$("#search").oninput=render;
function theme(){document.body.classList.toggle("light");localStorage.setItem("theme",document.body.classList.contains("light")?"light":"dark");$("#darkToggle").textContent=document.body.classList.contains("light")?"○":"●";$("#themeBtn").textContent=document.body.classList.contains("light")?"☾":"☼"}
$("#themeBtn").onclick=theme;$("#darkToggle").onclick=theme;
const fab=$("#fab");
let holdPointerId=null;
function cancelHold(){if(pressTimer){clearTimeout(pressTimer);pressTimer=null}fab.classList.remove("pressing")}
function pressStart(e){
  e.preventDefault(); e.stopPropagation();
  if(recording)return;
  if(e.pointerId!=null){holdPointerId=e.pointerId;try{fab.setPointerCapture(e.pointerId)}catch(_){} }
  fab.classList.add("pressing");
  pressTimer=setTimeout(()=>{pressTimer=null;begin()},220);
}
function pressEnd(e){
  e.preventDefault(); e.stopPropagation();
  if(e.pointerId!=null && holdPointerId!==null && e.pointerId!==holdPointerId)return;
  cancelHold();
  if(recording)finish();
  holdPointerId=null;
}
fab.addEventListener("pointerdown",pressStart,{passive:false});
fab.addEventListener("pointerup",pressEnd,{passive:false});
fab.addEventListener("pointercancel",pressEnd,{passive:false});
fab.addEventListener("lostpointercapture",()=>{if(recording)finish();cancelHold();holdPointerId=null});
fab.addEventListener("touchstart",e=>e.preventDefault(),{passive:false});
fab.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();return false};
window.addEventListener("pointerup",e=>{if(recording && holdPointerId===e.pointerId)pressEnd(e)});
(async()=>{setupWave();await openDB();notes=await getAll();render();if(localStorage.getItem("theme")==="light")document.body.classList.add("light")})();
