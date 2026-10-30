const socket=io();let state=null,selected=0,me=null,roomCode=null;
const $=id=>document.getElementById(id);
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
socket.on("connect",()=>$("connection").textContent="NETWORK ONLINE");
socket.on("disconnect",()=>$("connection").textContent="RECONNECTING");
socket.on("state",s=>{state=s;render();});
function enter(event,payload){socket.emit(event,payload,res=>{if(res?.error)return toast(res.error);roomCode=res.code;me=res.playerId;$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("roomcode").textContent=roomCode;});}
$("create").onclick=()=>enter("createRoom",{name:$("name").value});
$("join").onclick=()=>enter("joinRoom",{name:$("name").value,code:$("code").value.trim().toUpperCase()});
$("start").onclick=()=>socket.emit("startGame",res=>res?.error&&toast(res.error));
$("endturn").onclick=()=>socket.emit("endTurn",res=>res?.error&&toast(res.error));
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
 if(!state||state.phase!=="live")return toast("Conflict has not launched.");
 socket.emit("command",{action:b.dataset.action,sectorId:selected},res=>{if(res?.error)toast(res.error);else toast("Command transmitted.");});
});
function render(){
 if(!state)return;
 $("round").textContent=state.round;$("phase").textContent=state.phase.toUpperCase();
 $("roomcode").textContent=state.code;
 const meObj=state.players.find(p=>p.id===me);
 const colors={ATLAS:"#63a8ff",PHANTOM:"#c18aff",NOVA:"#53e0a0",ORACLE:"#ffc46b"};
 $("players").innerHTML=state.players.map(p=>`<div class="player"><strong><i class="dot" style="background:${colors[p.faction]}"></i>${esc(p.name)} ${p.id===me?"(YOU)":""}</strong><small>${p.faction} · ${p.score} PTS · ${p.energy} EN ${p.isBot?"· AUTONOMOUS":""}</small></div>`).join("");
 $("start").classList.toggle("hidden",!(state.phase==="lobby"&&state.hostId===me));
 $("endturn").classList.toggle("hidden",!(state.phase==="live"&&meObj&&!meObj.spectator&&!meObj.ready));
 $("hint").textContent=state.phase==="lobby"?"Share the room code. The host launches when ready.":state.phase==="ended"?"Conflict concluded. Refresh to create a new warroom.":meObj?.ready?"Turn submitted. Waiting for other commanders.":`Your faction: ${meObj?.faction||"OBSERVER"} · Energy: ${meObj?.energy??0}`;
 $("map").innerHTML=state.sectors.map(s=>`<div class="node ${selected===s.id?"selectednode":""}" data-id="${s.id}" style="border-bottom:3px solid ${s.owner?colors[s.owner]:"#314557"}"><strong>${s.name}</strong><small>${s.type} · DEF ${s.level}</small><span class="owner" style="color:${s.owner?colors[s.owner]:"#7890a5"}">${s.owner||"UNCLAIMED"}</span></div>`).join("");
 document.querySelectorAll(".node").forEach(n=>n.onclick=()=>{selected=Number(n.dataset.id);render();});
 const s=state.sectors.find(x=>x.id===selected);$("sectorname").textContent=s.name;$("sectordetail").textContent=`${s.type} // ${s.owner||"UNCLAIMED"} // DEFENSE LEVEL ${s.level} // ADJACENT: ${s.neighbors.map(i=>state.sectors[i].name).join(", ")}`;
 $("log").innerHTML=[...state.log].reverse().map(l=>`<div class="feedline"><time>${new Date(l.time).toLocaleTimeString()}</time>${esc(l.text)}</div>`).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
