const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || "*" } });
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));
app.get("/health", (_, res) => res.json({ ok: true, game: "AGENT WARROOM" }));

const FACTIONS = ["ATLAS", "PHANTOM", "NOVA", "ORACLE"];
const rooms = new Map();
const makeId = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const sectorsTemplate = () => [
  {id:0,name:"HELIOS GATE",type:"CORE",owner:"",level:1,neighbors:[1,3]},
  {id:1,name:"GLASS DESERT",type:"RESOURCE",owner:"",level:1,neighbors:[0,2,4]},
  {id:2,name:"BLACK RELAY",type:"COMMS",owner:"",level:1,neighbors:[1,5]},
  {id:3,name:"IRON VEIL",type:"FORTRESS",owner:"",level:1,neighbors:[0,4,6]},
  {id:4,name:"THE DEEP",type:"RESOURCE",owner:"",level:1,neighbors:[1,3,5,7]},
  {id:5,name:"GHOST ORBIT",type:"COMMS",owner:"",level:1,neighbors:[2,4]},
  {id:6,name:"ASHEN RING",type:"RESOURCE",owner:"",level:1,neighbors:[3,7]},
  {id:7,name:"SINGULARITY",type:"CORE",owner:"",level:1,neighbors:[4,6]}
];
function newRoom() {
  const code = makeId();
  const room = { code, phase:"lobby", round:1, maxRounds:12, players:[], sectors:sectorsTemplate(),
    log:[{text:"WARROOM INITIALIZED. Awaiting commanders.",time:Date.now()}], createdAt:Date.now(), hostId:null };
  rooms.set(code, room);
  return room;
}
function publicState(room) {
  return {code:room.code,phase:room.phase,round:room.round,maxRounds:room.maxRounds,
    players:room.players.map(({id,name,faction,energy,influence,score,ready,online,isBot,spectator})=>({id,name,faction,energy,influence,score,ready,online,isBot,spectator})),
    sectors:room.sectors,log:room.log.slice(-35),hostId:room.hostId};
}
function emitRoom(room) { io.to(room.code).emit("state", publicState(room)); }
function log(room, text) { room.log.push({text,time:Date.now()}); if(room.log.length>100) room.log.shift(); }
function playerById(room,id) { return room.players.find(p=>p.id===id); }
function scorePlayer(room,p) {
  return room.sectors.filter(s=>s.owner===p.faction).reduce((n,s)=>n+10+(s.level-1)*3,0) + p.influence;
}
function addPlayer(room,socket,name,spectator=false) {
  if(room.players.length>=50) return {error:"This warroom is full (50 commanders maximum)."};
  const used = room.players.map(p=>p.faction);
  const faction = FACTIONS.find(f=>!used.includes(f)) || FACTIONS[Math.floor(Math.random()*4)];
  const p = {id:socket.id,name:(name||"COMMANDER").trim().slice(0,18)||"COMMANDER",faction,
    energy:5,influence:0,score:0,ready:false,online:true,isBot:false,spectator};
  room.players.push(p); socket.join(room.code);
  if(!room.hostId) room.hostId=socket.id;
  return {player:p};
}
function ensureBots(room) {
  for(const faction of FACTIONS) {
    if(!room.players.some(p=>p.faction===faction)) {
      room.players.push({id:"BOT_"+faction,name:faction+" // AGENT",faction,energy:5,influence:0,score:0,ready:true,online:true,isBot:true,spectator:false});
    }
  }
}
function begin(room) {
  if(room.phase!=="lobby") return;
  room.phase="live"; ensureBots(room);
  room.players.filter(p=>!p.isBot).forEach(p=>{p.energy=5;p.ready=false;});
  log(room,"CONFLICT DECLARED. Autonomous agents online. Round 1 begins.");
  emitRoom(room);
}
function validTarget(room,p,sector) {
  return sector && (sector.owner===p.faction || sector.neighbors.some(id=>room.sectors[id].owner===p.faction) ||
    !room.sectors.some(s=>s.owner===p.faction));
}
function command(room,p,action,sectorId) {
  if(room.phase!=="live" || p.spectator || p.energy<=0) return {error:"Command unavailable."};
  const s=room.sectors.find(x=>x.id===Number(sectorId));
  if(!s) return {error:"Unknown sector."};
  if(action==="deploy") {
    if(p.energy<3) return {error:"Deploy costs 3 energy."};
    if(s.owner && s.owner!==p.faction) return {error:"Sector controlled by an opposing faction."};
    if(!validTarget(room,p,s)) return {error:"Deploy into an adjacent sector or your starting frontier."};
    if(s.owner===p.faction) return {error:"Already under your control."};
    s.owner=p.faction; p.energy-=3; log(room,`${p.faction} deployed into ${s.name}.`);
  } else if(action==="fortify") {
    if(s.owner!==p.faction || p.energy<2) return {error:"Fortify requires your sector and 2 energy."};
    s.level=Math.min(4,s.level+1); p.energy-=2; log(room,`${p.faction} fortified ${s.name} to level ${s.level}.`);
  } else if(action==="influence") {
    if(p.energy<1) return {error:"Influence costs 1 energy."};
    p.influence+=5; p.energy-=1; log(room,`${p.faction} executed a diplomacy operation (+5 influence).`);
  } else if(action==="scout") {
    if(p.energy<1) return {error:"Scout costs 1 energy."};
    p.energy-=1; log(room,`${p.faction} scanned ${s.name}: ${s.owner||"UNCLAIMED"} / DEF ${s.level}.`);
  } else return {error:"Unknown command."};
  p.score=scorePlayer(room,p);
  return {ok:true};
}
function botTurn(room) {
  for(const bot of room.players.filter(p=>p.isBot)) {
    bot.energy=5;
    const owned=room.sectors.filter(s=>s.owner===bot.faction);
    const candidates=room.sectors.filter(s=>!s.owner && (!owned.length || s.neighbors.some(n=>room.sectors[n].owner===bot.faction)));
    if(candidates.length && bot.energy>=3) {
      const target=candidates.sort((a,b)=>(a.type==="RESOURCE"?-1:0)-(b.type==="RESOURCE"?-1:0))[0];
      target.owner=bot.faction; bot.energy-=3; log(room,`${bot.faction} // AGENT expanded into ${target.name}.`);
    } else if(owned.length) {
      const target=owned.sort((a,b)=>a.level-b.level)[0];
      if(target.level<4){target.level++;bot.energy-=2;log(room,`${bot.faction} // AGENT fortified ${target.name}.`);}
      else {bot.influence+=5;bot.energy--;}
    } else { bot.influence+=5; }
    bot.score=scorePlayer(room,bot);
  }
}
function advance(room) {
  if(room.phase!=="live") return;
  room.round++;
  if(room.round>room.maxRounds) {
    room.phase="ended";
    const ranking=[...room.players].sort((a,b)=>scorePlayer(room,b)-scorePlayer(room,a));
    log(room,`WARROOM CLOSED. ${ranking[0]?.faction||"NO FACTION"} claims strategic victory.`);
  } else {
    room.players.forEach(p=>{p.energy=5;p.ready=false;p.score=scorePlayer(room,p);});
    botTurn(room);
    log(room,`ROUND ${room.round} // Command energy replenished.`);
  }
  emitRoom(room);
}
io.on("connection", socket => {
  socket.on("createRoom", ({name}, cb=()=>{}) => {
    const room=newRoom(); addPlayer(room,socket,name);
    room.hostId=socket.id; socket.data.room=room.code;
    cb({code:room.code,playerId:socket.id}); emitRoom(room);
  });
  socket.on("joinRoom", ({code,name,spectator=false}, cb=()=>{}) => {
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room) return cb({error:"Warroom code not found."});
    if(room.phase==="ended") return cb({error:"This warroom has ended."});
    const result=addPlayer(room,socket,name,spectator);
    if(result.error) return cb(result);
    socket.data.room=room.code;
    log(room,`${result.player.name} ${spectator?"joined as observer":"entered the warroom"}.`);
    cb({code:room.code,playerId:socket.id}); emitRoom(room);
  });
  socket.on("startGame",cb=>{const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id)return cb?.({error:"Only the host can launch."});begin(room);cb?.({ok:true});});
  socket.on("command",({action,sectorId},cb=()=>{})=>{
    const room=rooms.get(socket.data.room);const p=room&&playerById(room,socket.id);
    if(!room||!p)return cb({error:"Join a warroom first."});
    const result=command(room,p,action,sectorId); if(result.ok)emitRoom(room); cb(result);
  });
  socket.on("endTurn",cb=>{
    const room=rooms.get(socket.data.room);const p=room&&playerById(room,socket.id);
    if(!room||!p||p.spectator)return cb?.({error:"Not an active commander."});
    p.ready=true;
    const active=room.players.filter(x=>!x.isBot&&!x.spectator&&x.online);
    if(active.length && active.every(x=>x.ready)) advance(room);
    else emitRoom(room);
    cb?.({ok:true});
  });
  socket.on("disconnect",()=>{
    const room=rooms.get(socket.data.room);if(!room)return;
    const p=playerById(room,socket.id);if(p){p.online=false;log(room,`${p.name} connection lost.`);}
    if(room.hostId===socket.id){const next=room.players.find(x=>x.online&&!x.isBot);room.hostId=next?.id||null;}
    emitRoom(room);
  });
});
setInterval(()=>{
  for(const room of rooms.values()) {
    const active=room.players.filter(p=>!p.isBot&&!p.spectator&&p.online);
    if(room.phase==="live" && active.length && active.every(p=>p.ready)) advance(room);
    if(Date.now()-room.createdAt>6*60*60*1000) rooms.delete(room.code);
  }
},15000);
server.listen(PORT,()=>console.log(`AGENT WARROOM listening on ${PORT}`));
