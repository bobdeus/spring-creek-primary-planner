"use strict";

const $ = id => document.getElementById(id);
const groupNames = ["Nursery", "Sunbeams", "CTR 4", "CTR 5", "CTR 6", "Valiant 7", "Valiant 8", "Valiant 9", "Valiant 10"];
const classes = groupNames.flatMap((group, index) => (index < 2 ? [""] : [" A", " B"]).map(section => ({
  id: (group + section).toLowerCase().replaceAll(" ", "-"),
  name: group + section, group, family: ["nursery", "sun"][index] || (index < 5 ? "ctr" : "val")
})));
const className = id => classes.find(c => c.id === id)?.name || "Unassigned";
const storageKey = "spring-creek-fourth-ward.primary-planner.2027.v1";
const types = { adults: "Adults", children: "Children", rooms: "Rooms" };
const singular = { adults: "adult", children: "child", rooms: "room" };
const paths = {
  mountain: '<path d="M2 17 9 5l5 8 3-5 5 9M5 17l4-7 2 3M3 20c5-3 8 2 13-1 2-1 3-1 5-1"/>',
  export: '<path d="M12 15V3m-4 4 4-4 4 4M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  child: '<circle cx="10" cy="7" r="3.5"/><path d="M3 20v-2a7 7 0 0 1 14 0v2m0-15a3 3 0 0 1 0 6m2 3a6 6 0 0 1 2 5"/>',
  adults: '<circle cx="9" cy="7" r="3.5"/><path d="M2 20v-2a7 7 0 0 1 14 0v2m0-16a3.5 3.5 0 0 1 0 7m2 3a6 6 0 0 1 4 6"/>',
  room: '<path d="M4 21h16M6 21V4l10-2v19m0-16h3v16M12 12h.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 6 9 7 9-7"/>'
};
const icon = name => '<svg aria-hidden="true" class="ico" viewBox="0 0 24 24">' + paths[name] + '</svg>';
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
const label = (type, item) => type === "children" ? [item.first, item.last].filter(Boolean).join(" ") : item.name;
const byName = (type, a, b) => {
  const order = type === "children" ? a.last.localeCompare(b.last) : 0;
  return order || label(type, a).localeCompare(label(type, b), undefined, { numeric:true });
};
const sorted = (type, items) => [...items].sort((a,b) => byName(type, a, b));
let state, lastSaved, activeType = "adults", lastFocus, noticeTimer;
let phoneClass = "sunbeams", editingPool = false, undoMove;
const onlyFree = { adults:true, children:false, rooms:false };
const expanded = new Set();
function notify(message) {
  clearTimeout(noticeTimer);
  undoMove=null;
  $("notice").textContent = message;
  noticeTimer = setTimeout(() => { $("notice").textContent = ""; }, 4000);
}
function persist() {
  const value = JSON.stringify(state);
  try {
    const current = localStorage.getItem(storageKey);
    if (current !== lastSaved && current) {
      state = JSON.parse(current);
      lastSaved = current;
      notify("Another tab saved a change. Review the updated board and try again.");
    } else {
      localStorage.setItem(storageKey, value);
      lastSaved = value;
      $("saved").textContent = "Saved on this device";
    }
  } catch {
    $("saved").textContent = "Session only · export to keep";
    notify("Browser storage is unavailable. Export the plan to keep your edits.");
  }
}
function usable(plan) {
  return plan?.version === 1 && ["adults","children","rooms"].every(k => Array.isArray(plan[k])) && plan.assignments && typeof plan.assignments === "object";
}
async function openPlanner() {
  document.querySelectorAll("[data-icon]").forEach(el => el.innerHTML = icon(el.dataset.icon));
  try { lastSaved = localStorage.getItem(storageKey); } catch { lastSaved = null; }
  try {
    const embedded = $("starting-roster")?.textContent;
    const fragment = new URLSearchParams(location.hash.slice(1));
    const packed=fragment.get("p");
    let source = lastSaved || embedded || fragment.get("roster");
    if(!source && packed){
      const binary=atob(packed.replaceAll("-","+").replaceAll("_","/"));
      const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      source=await new Response(stream).text();
    }
    if (!source) { $("gate").querySelector("h2").textContent = "Open your preloaded planner"; return; }
    state = JSON.parse(source);
    if (!usable(state)) throw new Error("Invalid planner");
    persist();
    if (fragment.has("roster") || packed) { try { history.replaceState(null, "", location.pathname + location.search); } catch {} }
    $("group-filter").innerHTML = '<option value="">All classes</option>' + groupNames.map(g => '<option>'+g+'</option>').join("");
    try {
      const previous = localStorage.getItem(storageKey+".class");
      if(classes.some(c=>c.id===previous)) phoneClass=previous;
    } catch {}
    $("phone-class-select").innerHTML = options(classes.map(c=>[c.id,c.name]),phoneClass);
    $("workspace").hidden = $("top-actions").hidden = false;
    $("gate").hidden = true;
    render();
  } catch { $("gate").innerHTML = "<h2>Couldn’t read this planner</h2><p>Open your original preloaded planner in a new browser profile to start from the roster. Any existing saved data stays on this device.</p>"; }
}
function isFree(type, item) {
  return type === "rooms" ? !Object.values(state.assignments).includes(item.id) : !item.classId;
}
function personButton(type, item, directory = false) {
  const name = label(type, item);
  const initials = name.split(/\s+/).filter(Boolean).map(s => s[0]).filter((_,i,a) => i === 0 || i === a.length-1).join("");
  const where = type === "rooms" ? classes.filter(c => state.assignments[c.id] === item.id).map(c => c.name).join(", ") : className(item.classId);
  const detail = type === "adults" ? item.role + (item.classId ? " · " + where : "") : where || "Unassigned";
  const grip = '<span class="grip" aria-hidden="true"></span>';
  return '<button type="button" class="person" draggable="'+(item.id !== "nursery-room")+'" data-type="'+type+'" data-id="'+esc(item.id)+'" aria-label="Edit '+esc(name)+'">'+
    (directory ? '<span class="avatar" aria-hidden="true">'+(type === "rooms" ? icon("room") : esc(initials))+'</span>' : grip) +
    '<span class="person-text">'+esc(name)+(directory ? '<small>'+esc(detail)+'</small>' : '')+'</span>'+(directory && item.id !== "nursery-room" ? grip : '')+'</button>';
}
function renderCards() {
  const group = $("group-filter").value;
  $("cards").innerHTML = classes.filter(c => !group || c.group === group).map(c => {
    const kids = sorted("children",state.children.filter(p => p.classId === c.id));
    const adults = sorted("adults",state.adults.filter(p => p.classId === c.id));
    const open = expanded.has(c.id), visible = open ? kids : kids.slice(0,3);
    return '<article class="card" aria-label="'+c.name+'" data-class="'+c.id+'" data-family="'+c.family+'"><div class="card-heading"><h3>'+c.name+'</h3></div>'+roomField(c)+
      '<span class="card-label">'+(c.id === "nursery" ? "Nursery Leaders" : "Teachers")+'</span>'+adults.map(a=>personButton("adults",a)).join("")+
      '<button class="people-button" data-adults-for="'+c.id+'">'+icon("plus")+(adults.length ? "Manage adults" : c.id === "nursery" ? "Assign leaders" : "Assign teachers")+'</button>'+
      '<div class="roster-title"><span>Children</span><span class="count">'+kids.length+'</span></div>'+
      (kids.length ? visible.map(k=>personButton("children",k)).join("") : '<p class="empty">No children assigned</p>')+
      (kids.length>3 ? '<button class="more" data-expand="'+c.id+'" aria-expanded="'+open+'">'+(open ? "Show fewer" : "Show "+(kids.length-3)+" more")+'</button>' : '')+'</article>';
  }).join("");
}
function renderDirectory() {
  $("tabs").innerHTML = Object.entries(types).map(([key,title]) => '<button data-tab="'+key+'" aria-pressed="'+(key===activeType)+'">'+title+'</button>').join("");
  $("only-free").checked = onlyFree[activeType];
  $("free-filter").hidden=activeType==="adults";
  $("available-label").hidden=activeType!=="adults";
  $("available-label").textContent=state.adults.filter(a=>!a.classId).length+" available";
  $("search").placeholder = "Search "+types[activeType].toLowerCase();
  $("add-entry").setAttribute("aria-label","Add "+singular[activeType]);
  const query = $("search").value.trim().toLocaleLowerCase();
  const matches = sorted(activeType,state[activeType].filter(p => ((activeType!=="adults" && !onlyFree[activeType]) || isFree(activeType,p)) &&
    [label(activeType,p),p.middle,p.role,activeType === "rooms" ? "" : className(p.classId)].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)));
  $("found").textContent = matches.length+" shown";
  $("entries").innerHTML = matches.map(p => personButton(activeType,p,true)).join("") || '<p class="empty">No matching entries.</p>';
}
function renderTotals() {
  const stats = [["grid",classes.length,"Classes"],["child",state.children.length,"Children"],["adults",state.adults.length,"Teachers & leaders"],["room",state.rooms.length,"Rooms"]];
  $("totals").innerHTML = stats.map(([symbol,count,title])=>'<div class="stat"><span class="stat-icon">'+icon(symbol)+'</span><div><strong>'+count+'</strong><small>'+title+'</small></div></div>').join("");
}
function render() {
  renderTotals();renderRoomOptions();renderCards();renderDirectory();renderPhone();
}
function roomField(c) {
  const room = state.rooms.find(r=>r.id===state.assignments[c.id]);
  return '<label class="inline-room"><span>'+icon("room")+'Room</span>'+(c.id==="nursery" ? '<strong>Nursery</strong>' :
    '<input data-room-input="'+c.id+'" aria-label="Room for '+c.name+'" value="'+esc(room?.name)+'" list="room-options" maxlength="100" placeholder="Room number" autocomplete="off" enterkeyhint="done">')+'</label>';
}
function renderRoomOptions() {
  $("room-options").innerHTML=sorted("rooms",state.rooms.filter(r=>r.id!=="nursery-room")).map(r=>'<option value="'+esc(r.name)+'"></option>').join("");
}
function setTypedRoom(input) {
  const classId=input.dataset.roomInput, name=input.value.trim();
  if(classId==="nursery" || !classes.some(c=>c.id===classId))return;
  let room=state.rooms.find(r=>r.name.toLowerCase()===name.toLowerCase());
  if(room?.id==="nursery-room"){
    input.setCustomValidity("Nursery is reserved for the Nursery class.");input.reportValidity();return;
  }
  input.setCustomValidity("");
  const old=state.rooms.find(r=>r.id===state.assignments[classId]);
  if(name && !room) {
    if(old?.typing && Object.values(state.assignments).filter(id=>id===old.id).length===1){
      old.name=name;room=old;
    } else {
      room={id:crypto.randomUUID(),name,typing:true};state.rooms.push(room);
    }
  }
  if(room)state.assignments[classId]=room.id;
  else delete state.assignments[classId];
  if(old?.typing && old!==room && !Object.values(state.assignments).includes(old.id))state.rooms=state.rooms.filter(r=>r!==old);
  persist();renderTotals();renderRoomOptions();if(activeType==="rooms")renderDirectory();
  document.querySelectorAll('[data-room-input="'+classId+'"]').forEach(peer=>{if(peer!==input)peer.value=room?.name || "";});
}
function renderPhonePool() {
  const query=$("phone-search").value.trim().toLowerCase();
  const free=state.adults.filter(a=>!a.classId);
  const adults=sorted("adults",free).filter(a=>a.name.toLowerCase().includes(query));
  $("phone-available").textContent=free.length+" available";
  $("phone-pool-hint").textContent=editingPool?"Tap to edit.":"Tap or drag a teacher.";
  $("phone-mode").textContent=editingPool?"Done editing":"Edit list";
  $("phone-mode").setAttribute("aria-pressed",editingPool);
  $("phone-adults").innerHTML=adults.map(a=>{
    const grip=editingPool?"":'<span class="teacher-grip" aria-hidden="true"><span class="grip"></span></span>';
    return '<button class="pool-person" data-pool-id="'+esc(a.id)+'" aria-label="'+esc((editingPool?"Edit ":"Assign ")+a.name+(editingPool?"":" to "+className(phoneClass)))+'"><span class="pool-text"><span>'+esc(a.name)+'</span><small>'+
      (a.role==="Nursery Leader"?"Nursery leader":"Teacher")+'</small></span>'+grip+'</button>';
  }).join("") || '<p class="empty">'+(free.length?"No matches":"All adults assigned")+'</p>';
}
function renderPhone() {
  const c=classes.find(c=>c.id===phoneClass);
  const adults=sorted("adults",state.adults.filter(a=>a.classId===c.id));
  const kids=sorted("children",state.children.filter(k=>k.classId===c.id));
  const twin=classes.find(other=>other.group===c.group && other.id!==c.id);
  $("phone-class-select").value=phoneClass;
  $("phone-card").innerHTML=roomField(c)+
    '<div class="phone-list-title"><h3>'+(c.id==="nursery"?"Nursery Leaders":"Teachers")+'</h3><span class="count">'+adults.length+'</span></div>'+
    (adults.map(a=>'<div class="phone-row"><button data-type="adults" data-id="'+esc(a.id)+'">'+esc(a.name)+'</button><button class="phone-clear" data-unassign="'+esc(a.id)+'" aria-label="Unassign '+esc(a.name)+'">'+icon("close")+'</button></div>').join("") || '<p class="phone-empty">Tap a name on the left to assign someone.</p>')+
    '<div class="phone-list-title"><h3>Children</h3><span class="count">'+kids.length+'</span></div>'+
    kids.map(k=>'<div class="phone-row"><button data-type="children" data-id="'+esc(k.id)+'">'+esc(label("children",k))+'</button>'+(twin?'<button class="phone-transfer" data-move-kid="'+esc(k.id)+'" data-to="'+twin.id+'" aria-label="Move '+esc(label("children",k))+' to '+twin.name+'">To '+twin.name.slice(-1)+'</button>':'')+'</div>').join("")+
    (!kids.length?'<p class="phone-empty">No children assigned.</p>':'')+'<button class="phone-add" id="phone-add-child">+ Add child</button><button class="phone-tools" id="phone-rooms">Manage rooms</button>';
  renderPhonePool();
}
function movePerson(type,id,to) {
  const p=state[type].find(p=>p.id===id);
  if(!p || p.classId===to)return;
  const from=p.classId;
  p.classId=to;persist();render();
  notify(to?"Assigned to "+className(to)+".":"Assignment cleared.");
  $("notice").insertAdjacentHTML("beforeend",'<button id="undo" type="button">Undo</button>');
  undoMove=()=>{
    const current=state[type].find(x=>x.id===id);
    if(current?.classId===to){current.classId=from;persist();render();}
    notify("Move undone.");
  };
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>{$("notice").textContent="";undoMove=null;},10000);
}
function showDialog(title, body) {
  if (!$("dialog").open) lastFocus = document.activeElement;
  $("dialog-title").textContent = title;
  $("dialog-body").innerHTML = body;
  if (!$("dialog").open) $("dialog").showModal();
  const first = $("dialog-body").querySelector('input:not([type=checkbox]),select');
  first?.focus();
}
function commitChange() { persist(); render(); $("dialog").close(); }
function field(title, name, value = "", required = true) {
  return '<label class="field-label">'+title+'<input class="field" name="'+name+'" maxlength="160" value="'+esc(value)+'" '+(required?'required':'')+'></label>';
}
function options(items, current) {
  return items.map(([id,name]) => '<option value="'+esc(id)+'" '+(id===current?"selected":"")+'>'+esc(name)+'</option>').join("");
}
function selectField(title, name, items, current) {
  return '<label class="field-label">'+title+'<select class="field" name="'+name+'" aria-label="'+esc(title)+'">'+options(items,current)+'</select></label>';
}
const footer = (action,remove=false) => '<div class="form-foot">'+(remove?'<button type="button" class="danger" id="remove">Remove entry</button>':'')+'<button class="primary" type="submit">'+action+'</button></div>';
function editEntry(type, id, initialClass = null) {
  const entry = state[type].find(p=>p.id===id), item = entry || (type==="rooms"?{}:{classId:initialClass});
  if (id === "nursery-room") { showDialog("Nursery room",'<p class="dialog-copy">This room is reserved for Nursery throughout the year.</p>'); return; }
  let controls = type === "children" ? field("First name","first",item.first)+field("Middle name","middle",item.middle,false)+field("Last name","last",item.last) :
    field(type === "rooms" ? "Room number or name" : "Name","name",item.name);
  if (type === "adults") controls += selectField("Role","role",["Primary Teacher","Nursery Leader"].map(x=>[x,x]),item.role);
  if (type !== "rooms") controls += selectField("Class","classId",[["","Unassigned"],...classes.map(c=>[c.id,c.name])],item.classId || "");
  else controls += '<span class="field-label">Classes using this room</span><div class="checks">'+classes.filter(c=>c.id!=="nursery").map(c=>
    '<label><input type="checkbox" name="roomClass" value="'+c.id+'" '+(id && state.assignments[c.id]===id?"checked":"")+'>'+c.name+'</label>').join("")+'</div>';
  showDialog((entry?"Edit ":"Add ")+singular[type],'<form class="edit-form">'+controls+footer(entry?"Save changes":"Add "+singular[type],!!entry)+'</form>');
  $("dialog-body").querySelector("form").onsubmit = event => {
    event.preventDefault();
    const form = event.currentTarget;
    for(const input of form.querySelectorAll("input[required]")) {
      if(!input.value.trim()) {input.setCustomValidity("Enter a name or number.");input.reportValidity();input.oninput=()=>input.setCustomValidity("");return;}
    }
    const data = new FormData(form);
    if (type==="rooms" && state.rooms.some(r=>r.id!==id && r.name.toLowerCase()===data.get("name").trim().toLowerCase())) {
      const input=form.elements.name;input.setCustomValidity("This room already exists.");input.reportValidity();input.oninput=()=>input.setCustomValidity("");return;
    }
    if(!entry){item.id=crypto.randomUUID();state[type].push(item);}
    for (const [key,value] of data) if(key!=="roomClass") item[key]=key==="classId" ? value || null : value.trim();
    if(type==="rooms"){
      for(const c of classes) if(state.assignments[c.id]===item.id) delete state.assignments[c.id];
      for(const classId of data.getAll("roomClass")) state.assignments[classId]=item.id;
    }
    commitChange();
  };
  if(entry) $("remove").onclick = () => {
    showDialog("Remove "+singular[type]+"?",'<p class="dialog-copy">Remove <strong>'+esc(label(type,item))+'</strong> from this plan and clear their assignments?</p><div class="form-foot"><button class="outline" id="cancel-remove">Keep entry</button><button class="primary" id="confirm-remove">Remove entry</button></div>');
    $("cancel-remove").onclick=()=>editEntry(type,id);
    $("confirm-remove").onclick=()=>{
      state[type]=state[type].filter(p=>p.id!==id);
      if(type==="rooms") for(const c of classes) if(state.assignments[c.id]===id) delete state.assignments[c.id];
      commitChange();
    };
  };
}
function chooseChild() {
  const available=sorted("children",state.children.filter(p=>p.classId!==phoneClass));
  const choices=[["","Choose a child"],...available.map(p=>[p.id,label("children",p)+" · "+className(p.classId)])];
  showDialog("Add to "+className(phoneClass),'<form class="edit-form">'+selectField("Existing child","child",choices,"")+
    '<div class="form-foot"><button type="button" class="outline" id="phone-new-child">New child</button><button class="primary">Assign child</button></div></form>');
  $("dialog-body").querySelector("form").onsubmit=e=>{
    e.preventDefault();const id=new FormData(e.currentTarget).get("child");
    if(id){$("dialog").close();movePerson("children",id,phoneClass);}
  };
}
function assignAdults(classId) {
  const buttons=sorted("adults",state.adults).map(a=>'<label><input type="checkbox" name="adult" value="'+esc(a.id)+'" '+(a.classId===classId?"checked":"")+'><span>'+esc(a.name)+'<small> · '+esc(a.classId?className(a.classId):a.role)+'</small></span></label>').join("");
  showDialog("Adults for "+className(classId),'<form class="edit-form"><p class="dialog-copy">Select everyone serving in this class. Selecting someone assigned elsewhere moves them here.</p><div class="checks">'+(buttons||"No adults in the directory.")+'</div>'+footer("Save assignments")+'</form>');
  $("dialog-body").querySelector("form").onsubmit=e=>{
    e.preventDefault();const ids=new Set(new FormData(e.currentTarget).getAll("adult"));
    for(const a of state.adults) {if(ids.has(a.id)) a.classId=classId;else if(a.classId===classId) a.classId=null;}
    commitChange();
  };
}

function exportPlan() {
  const named = (type, item) => type === "children" ? { ...item, name:[item.first,item.middle,item.last].filter(Boolean).join(" ") } : { ...item };
  const entries = (type, predicate) => sorted(type,state[type].filter(predicate)).map(p=>named(type,p));
  return {
    schemaVersion:1, ward:"Spring Creek Fourth Ward", organization:"Primary", year:2027,
    exportedAt:new Date().toISOString(),
    classes:classes.map(c=>({
      id:c.id, name:c.name, room:state.rooms.find(r=>r.id===state.assignments[c.id]) || null,
      adults:entries("adults",p=>p.classId===c.id), children:entries("children",p=>p.classId===c.id)
    })),
    unassigned:Object.fromEntries(Object.keys(types).map(t=>[t,entries(t,p=>isFree(t,p))])),
    rooms:sorted("rooms",state.rooms).map(r=>({id:r.id,name:r.name,classes:classes.filter(c=>state.assignments[c.id]===r.id).map(c=>({id:c.id,name:c.name}))}))
  };
}
function planFile() {
  const date=new Date();
  const localDate=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
  return new File([JSON.stringify(exportPlan(),null,2)+"\n"],"Spring-Creek-Primary-2027-"+localDate+".json",{type:"application/json"});
}
function download(file) {
  const a=document.createElement("a");
  a.href=URL.createObjectURL(file);a.download=file.name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}
function showExport() {
  showDialog("Export classroom plan",'<p class="dialog-copy">Save the complete plan as a readable JSON file, including names, rooms, and unassigned entries. Share the file with the person preparing class lists and door signs.</p><div class="export-actions"><button class="primary" id="download">'+icon("download")+'Download JSON</button><button class="outline" id="share">'+icon("mail")+'Share or email file</button><div id="share-status" role="status"></div></div>');
  $("download").onclick=()=>{download(planFile());$("share-status").textContent="JSON file downloaded.";};
  $("share").onclick=async()=>{
    const file=planFile(), data={files:[file],title:"2027 Primary classroom plan"};
    try {
      if(navigator.canShare?.(data) && navigator.share) {
        await navigator.share(data); $("share-status").textContent="File handed to your share app."; return;
      }
    } catch(error) { if(error.name==="AbortError") return; }
    download(file);
    const body="Here is the 2027 Spring Creek Fourth Ward Primary classroom plan for the class lists and door signs.";
    const mail="mailto:?subject="+encodeURIComponent("2027 Primary classroom plan")+"&body="+encodeURIComponent(body);
    $("share-status").innerHTML='<p class="dialog-copy">The JSON file has been downloaded. Open an email draft, choose a recipient, and attach <strong>'+esc(file.name)+'</strong> from Downloads.</p><a class="outline" href="'+esc(mail)+'">Open email draft</a>';
  };
}
document.addEventListener("click",e=>{
  const button=e.target.closest("button");
  if(!button)return;
  const d=button.dataset;
  if(d.id) editEntry(d.type,d.id);
  else if(d.tab){activeType=d.tab;$("search").value="";renderDirectory();$("tabs").querySelector('[data-tab="'+activeType+'"]').focus();}
  else if(d.expand){expanded.has(d.expand)?expanded.delete(d.expand):expanded.add(d.expand);renderCards();$("cards").querySelector('[data-expand="'+d.expand+'"]').focus();}
  else if(d.poolId){
    const adult=state.adults.find(a=>a.id===d.poolId);
    if(editingPool)editEntry("adults",d.poolId);
    else if(adult && !adult.classId)movePerson("adults",adult.id,phoneClass);
  }
  else if(d.unassign)movePerson("adults",d.unassign,null);
  else if(d.moveKid)movePerson("children",d.moveKid,d.to);
  else if(button.id==="undo")undoMove?.();
  else if(button.id==="phone-mode"){editingPool=!editingPool;renderPhonePool();}
  else if(button.id==="phone-new-adult")editEntry("adults");
  else if(button.id==="phone-new-child")editEntry("children",null,phoneClass);
  else if(button.id==="phone-add-child")chooseChild();
  else if(button.id==="phone-rooms") {
    showDialog("Manage rooms",'<div class="room-directory">'+sorted("rooms",state.rooms).map(r=>personButton("rooms",r,true)).join("")+'</div><button class="outline" id="phone-new-room">Add room</button>');
  }
  else if(button.id==="phone-new-room")editEntry("rooms");
  else if(d.adultsFor) assignAdults(d.adultsFor);
  else if(button.id==="add-entry")editEntry(activeType);
  else if(button.id==="close")$("dialog").close();
  else if(button.id==="export")showExport();
});
$("dialog").addEventListener("close",()=>{
  if(lastFocus?.isConnected){lastFocus.focus();return;}
  const attr=["id","adultsFor","poolId"].find(k=>lastFocus?.dataset[k]);
  const replacement=attr && [...document.querySelectorAll("button")].find(b=>b.dataset[attr]===lastFocus.dataset[attr] && b.offsetWidth>0);
  (replacement || (matchMedia("(max-width:700px)").matches ? $("phone-class-select") : $("add-entry"))).focus({preventScroll:true});
});
$("phone-search").addEventListener("input",renderPhonePool);
$("phone-class-select").addEventListener("change",e=>{
  phoneClass=e.target.value;
  try{localStorage.setItem(storageKey+".class",phoneClass);}catch{}
  renderPhone();
});
document.addEventListener("input",e=>{if(e.target.matches("[data-room-input]"))setTypedRoom(e.target);});
document.addEventListener("focusout",e=>{
  const classId=e.target.dataset?.roomInput;
  if(!classId)return;
  const room=state.rooms.find(r=>r.id===state.assignments[classId]);
  const rejected=!e.target.validity.valid;
  e.target.value=room?.name || "";
  if(rejected){e.target.setCustomValidity("");notify("Nursery is reserved. Your previous room assignment was kept.");}
  if(room?.typing){delete room.typing;persist();}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Enter" && e.target.matches("[data-room-input]")){e.preventDefault();e.target.blur();}
});
$("only-free").addEventListener("change",e=>{onlyFree[activeType]=e.target.checked;renderDirectory();});
$("search").addEventListener("input",renderDirectory);
$("group-filter").addEventListener("change",renderCards);

let drag;
let phoneDrag;
let suppressDragClick=false;
const phoneTarget=document.querySelector(".phone-class");
function insidePhoneClass(event) {
  return phoneTarget.contains(document.elementFromPoint(event.clientX,event.clientY));
}
function endPhoneDrag() {
  if(!phoneDrag)return;
  const {handle,pointerId,ghost}=phoneDrag;
  phoneDrag=null;
  phoneTarget.classList.remove("drop-ready","drop-over");
  handle.classList.remove("dragging-teacher");
  ghost?.remove();
  if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);
}
$("phone-adults").addEventListener("pointerdown",event=>{
  const handle=event.target.closest("[data-pool-id]");
  if(editingPool || !handle || !event.isPrimary || event.button!==0 || phoneDrag)return;
  phoneDrag={handle,pointerId:event.pointerId,id:handle.dataset.poolId,x:event.clientX,y:event.clientY,active:false,fromGrip:!!event.target.closest(".teacher-grip")};
});
document.addEventListener("pointermove",event=>{
  const d=phoneDrag;
  if(!d || d.pointerId!==event.pointerId)return;
  if(!d.active){
    const dx=Math.abs(event.clientX-d.x),dy=Math.abs(event.clientY-d.y);
    if(Math.max(dx,dy)<6)return;
    if(event.pointerType==="touch" && !d.fromGrip && dy>dx){
      endPhoneDrag();return;
    }
    d.active=true;
    d.handle.setPointerCapture(d.pointerId);
    d.handle.classList.add("dragging-teacher");
    phoneTarget.classList.add("drop-ready");
    d.ghost=document.createElement("span");d.ghost.className="drag-ghost";d.ghost.setAttribute("aria-hidden","true");
    d.ghost.textContent=state.adults.find(a=>a.id===d.id)?.name || "Teacher";
    document.body.append(d.ghost);
  }
  d.ghost.style.left=Math.max(6,Math.min(innerWidth-d.ghost.offsetWidth-6,event.clientX-d.ghost.offsetWidth/2))+"px";
  d.ghost.style.top=Math.max(6,event.clientY-d.ghost.offsetHeight-16)+"px";
  phoneTarget.classList.toggle("drop-over",insidePhoneClass(event));
});
document.addEventListener("pointerup",event=>{
  const d=phoneDrag;
  if(!d || event.pointerId!==d.pointerId)return;
  if(d.active){event.preventDefault();suppressDragClick=true;}
  const assign=d.active && insidePhoneClass(event);
  endPhoneDrag();
  if(assign)movePerson("adults",d.id,phoneClass);
});
for(const type of ["pointercancel","lostpointercapture"]){
  $("phone-adults").addEventListener(type,event=>{
    if(phoneDrag?.pointerId!==event.pointerId)return;
    if(type==="lostpointercapture" && event.target!==phoneDrag.handle)return;
    if(phoneDrag.active)suppressDragClick=true;
    endPhoneDrag();
  });
}
document.addEventListener("pointerdown",()=>{suppressDragClick=false;},true);
document.addEventListener("click",event=>{
  if(suppressDragClick && event.detail>0){
    suppressDragClick=false;event.preventDefault();event.stopImmediatePropagation();
  }
},true);
window.addEventListener("blur",endPhoneDrag);
document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && phoneDrag){suppressDragClick=phoneDrag.active;endPhoneDrag();}
});
const clearDrag=()=>{drag=null;document.querySelectorAll(".over").forEach(e=>e.classList.remove("over"));};
document.addEventListener("dragstart",e=>{
  const b=e.target.closest(".person[draggable=true]");
  if(!b) return;
  drag={type:b.dataset.type,id:b.dataset.id};
  e.dataTransfer.effectAllowed="move";
  e.dataTransfer.setData("text/plain",drag.id);
});
function dropTarget(e) {
  if(!drag)return null;
  const target=e.target.closest(".card,.tray");
  if(!target || (drag.type==="rooms" && (!target.dataset.class || target.dataset.class==="nursery")))return null;
  return target;
}
document.addEventListener("dragover",e=>{
  const target=dropTarget(e);
  if(target){e.preventDefault();e.dataTransfer.dropEffect="move";target.classList.add("over");}
});
document.addEventListener("dragleave",e=>{
  const target=e.target.closest(".over");
  if(target && !target.contains(e.relatedTarget))target.classList.remove("over");
});
document.addEventListener("drop",e=>{
  const target=dropTarget(e);
  if(!target)return;
  e.preventDefault();const {type,id}=drag, classId=target.dataset.class || null;
  const item=state[type].find(p=>p.id===id);
  if(!item)return;
  if(type==="rooms")state.assignments[classId]=id;else item.classId=classId;
  clearDrag();persist();render();notify(classId?"Assigned to "+className(classId)+".":"Moved to unassigned.");
});
document.addEventListener("dragend",clearDrag);
window.addEventListener("storage",e=>{
  if(e.key!==storageKey || !e.newValue || !state)return;
  try{
    const next=JSON.parse(e.newValue);
    if(!usable(next))return;
    lastSaved=e.newValue;state=next;if($("dialog").open)$("dialog").close();render();notify("Updated from another tab.");
  }catch{}
});
openPlanner();
