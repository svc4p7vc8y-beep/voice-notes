const $=s=>document.querySelector(s);
const notesEl=$("#notes"),search=$("#search"),recordScreen=$("#recordScreen"),noteScreen=$("#noteScreen"),settingsScreen=$("#settingsScreen");
const mic=$("#mic"),timer=$("#timer"),status=$("#status"),wave=$("#wave"),start=$("#start"),stop=$("#stop"),title=$("#title"),text=$("#text"),date=$("#date"),toast=$("#toast");
let notes=JSON.parse(localStorage.getItem("voiceNotesV2")||"null")||[
 {id:1,title:"Идея для проекта",text:"Нужно сделать приложение, в котором можно быстро записывать мысли голосом.",date:"Сегодня, 14:32",audio:false}
];
let current=null,rec=null,stream=null,recognition=null,recording=false,seconds=0,timerId=null,transcript="";
const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;

function save(){localStorage.setItem("voiceNotesV2",JSON.stringify(notes))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(q=""){let arr=notes.filter(n=>(n.title+" "+n.text).toLowerCase().includes(q.toLowerCase()));notesEl.innerHTML=arr.length?arr.map(n=>`<article class="note" data-id="${n.id}"><div class="note-row"><h3>${esc(n.title)}</h3><span>${n.audio?"🎙️":"📝"}</span></div><p>${esc(n.text)}</p><time>${esc(n.date)}</time></article>`).join(""):`<div class="empty">🎙️<strong>Заметок пока нет</strong>Нажмите кнопку записи.</div>`;document.querySelectorAll(".note").forEach(x=>x.onclick=()=>openNote(+x.dataset.id))}
function show(el){el.classList.add("active")} function hide(el){el.classList.remove("active")}
function toastMsg(s){toast.textContent=s;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1800)}
function formatTime(s){return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function reset(){seconds=0;timer.textContent="00:00";recording=false;clearInterval(timerId);mic.classList.remove("live");wave.classList.remove("live");start.classList.remove("hidden");stop.classList.add("hidden");status.textContent="Нажмите, чтобы начать";transcript=""}
function titleFrom(t){let w=t.replace(/[.!?]/g,"").split(/\s+/).filter(Boolean);return w.length?w.slice(0,6).join(" ").replace(/^./,c=>c.toUpperCase()):"Новая заметка"}
async function startRecording(){
 try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   rec=new MediaRecorder(stream);
   const chunks=[];
   rec.ondataavailable=e=>chunks.push(e.data);
   rec.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());finish(chunks)};
   rec.start();
 }catch(e){status.textContent="Нет доступа к микрофону";toastMsg("Разрешите микрофон в настройках Safari");return}
 recording=true;seconds=0;timerId=setInterval(()=>{seconds++;timer.textContent=formatTime(seconds)},1000);
 start.classList.add("hidden");stop.classList.remove("hidden");mic.classList.add("live");wave.classList.add("live");status.textContent="Я слушаю… говорите";
 if(Speech){recognition=new Speech();recognition.lang="ru-RU";recognition.continuous=true;recognition.interimResults=true;recognition.onresult=e=>{let s="";for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript+" ";transcript=s.trim()};recognition.onerror=e=>console.log(e);try{recognition.start()}catch(e){}}
}
function stopRecording(){if(!recording)return;recording=false;clearInterval(timerId);mic.classList.remove("live");wave.classList.remove("live");start.classList.remove("hidden");stop.classList.add("hidden");status.textContent="Обработка…";if(rec&&rec.state!=="inactive")rec.stop();else finish([]);try{recognition?.stop()}catch(e){}}
function finish(chunks){let t=transcript.trim()||"Голосовая заметка без расшифровки.";let d=new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});let n={id:Date.now(),title:titleFrom(t),text:t,date:`Сегодня, ${d}`,audio:true};notes.unshift(n);save();render(search.value);hide(recordScreen);openNote(n.id);reset()}
function openNote(id){current=notes.find(n=>n.id===id);if(!current)return;title.value=current.title;text.value=current.text;date.textContent=current.date;show(noteScreen)}
$("#recordFab").onclick=()=>{reset();show(recordScreen)}
$("#recordBack").onclick=()=>{if(recording)stopRecording();hide(recordScreen)}
start.onclick=startRecording;stop.onclick=stopRecording;
$("#noteBack").onclick=()=>hide(noteScreen);
$("#save").onclick=()=>{if(!current)return;current.title=title.value.trim()||"Без названия";current.text=text.value.trim();save();render(search.value);toastMsg("Сохранено")}
$("#delete").onclick=()=>{if(!current)return;if(confirm("Удалить заметку?")){notes=notes.filter(n=>n.id!==current.id);save();render(search.value);hide(noteScreen)}}
search.oninput=e=>render(e.target.value);
$("#settingsBtn").onclick=()=>show(settingsScreen);$("#settingsBack").onclick=()=>hide(settingsScreen);
function toggleDark(){document.body.classList.toggle("dark");localStorage.setItem("dark",document.body.classList.contains("dark")?"1":"0");$("#darkToggle").textContent=document.body.classList.contains("dark")?"●":"○"}
$("#themeBtn").onclick=toggleDark;$("#darkToggle").onclick=toggleDark;
if(localStorage.getItem("dark")==="1")document.body.classList.add("dark");
wave.innerHTML="<i></i>".repeat(9);
if(!navigator.mediaDevices?.getUserMedia)$("#support").textContent="Для записи нужен Safari с доступом к микрофону.";
if(!Speech)$("#support").textContent="Запись доступна, но автоматическая расшифровка речи этим браузером не поддерживается.";
render();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.log));
