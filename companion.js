/* ═══════════════════════════════════════════════════════════════
   LITTLE ACE — the canvas companion and his chat panel.

   He walks the page. At load the script asks the document which of its
   elements actually draw a horizontal edge — cards, trays, buttons, the
   hairline rules between blocks — and treats those as platforms; every
   frame it re-measures the ones on screen, so he climbs the real layout
   and rides it as the page scrolls. physics.js does the ballistics,
   knowledge.js answers the questions, in the browser: no answer is
   fetched from a server. Each exchange is then logged anonymously
   (fire-and-forget) to a Google Apps Script sheet at LOG_URL — see
   CHAT LOG below.

   Depends on window.AceKnowledge and window.AcePhysics; if either script
   failed to load, this one does nothing rather than half-building a
   companion that cannot move or talk.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const physics=window.AcePhysics;if(!physics)return;
/* knowledge.js (~350 KB) is only needed once someone talks to him, so it
   loads when the chat first opens rather than with every page. */
let knowledge=window.AceKnowledge||null,knowledgeLoad=null;
function loadKnowledge(){
 if(knowledge)return Promise.resolve(knowledge);
 if(!knowledgeLoad)knowledgeLoad=new Promise((res,rej)=>{const s=document.createElement('script');s.src='knowledge.js?v=3';
  s.onload=()=>{knowledge=window.AceKnowledge||null;knowledge?res(knowledge):rej();};s.onerror=()=>{knowledgeLoad=null;s.remove();rej();};document.head.append(s);});
 return knowledgeLoad;}

/* The walkable strip. state.x is his centre, so he has to stop this far
   short of either edge or half of him leaves the viewport. Named because
   the run logic below has to test against the same number it clamps to —
   that mismatch is what used to leave him running into the wall. */
const EDGE=40;
const clampX=x=>Math.max(EDGE,Math.min(innerWidth-EDGE,x));

const pet=document.createElement('button');pet.type='button';pet.className='ace-companion ace-loading';pet.setAttribute('aria-label','Ask Little Ace about Ace, the services, or events');pet.setAttribute('aria-controls','ace-chat');pet.setAttribute('aria-expanded','false');
/* Backing store is one atlas cell, shown at half that in CSS px — so a 2x
   display gets the artwork pixel for pixel. See CELL_W/CELL_H below. */
const canvas=document.createElement('canvas');canvas.width=240;canvas.height=280;canvas.setAttribute('aria-hidden','true');pet.append(canvas);document.body.append(pet);
const shadow=document.createElement('div');shadow.className='ace-shadow';shadow.ariaHidden='true';document.body.append(shadow);
/* Dims the page behind the chat so the panel and the big companion carry
   the screen. Deliberately pointer-events:none rather than a click-catcher:
   the panel is aria-modal="false" and the site stays usable behind it, so
   this darkens without taking the page hostage. */
const scrim=document.createElement('div');scrim.className='ace-scrim';scrim.ariaHidden='true';document.body.append(scrim);
const launcher=document.createElement('button');launcher.type='button';launcher.className='ace-launcher';launcher.innerHTML='<span aria-hidden="true"><img class="ace-spade" src="assets/icons/favicon-192.png" alt=""></span><span>Ask Little Ace</span>';launcher.setAttribute('aria-controls','ace-chat');launcher.setAttribute('aria-expanded','false');document.body.append(launcher);
const panel=document.createElement('section');panel.id='ace-chat';panel.className='ace-chat';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','ace-chat-title');panel.innerHTML='<div class="ace-chat-head"><span class="ace-chat-symbol" aria-hidden="true"><img class="ace-spade" src="assets/icons/favicon-192.png" alt=""></span><div><h2 id="ace-chat-title">Little Ace</h2><p>Your guide to Ace Spaders</p></div><button type="button" class="ace-chat-close" aria-label="Close chat">×</button></div><div class="ace-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></div><div class="ace-chat-suggestions" aria-label="Suggested questions"><button type="button">Advisory fees</button><button type="button">About Ace</button><button type="button">Group Activities</button></div><form class="ace-chat-form"><label class="ace-sr" for="ace-question">Ask about Ace or the website</label><input id="ace-question" name="question" maxlength="600" autocomplete="off" placeholder="Ask a short, simple question…" required><button type="submit" aria-label="Send question">↑</button></form><div class="ace-chat-foot"><span>Published-site answers · questions logged anonymously</span><span class="ace-foot-actions"><button class="ace-xmas" type="button" aria-pressed="false" aria-label="Christmas mode"></button><button class="ace-park" type="button">Park Little Ace</button></span></div>';document.body.append(panel);
const log=panel.querySelector('.ace-chat-messages'),input=panel.querySelector('input'),close=panel.querySelector('.ace-chat-close'),parkButton=panel.querySelector('.ace-park');

/* Reduced motion parks him by default rather than hiding him: the chat is
   the point, and the walking is the part that has to yield. */
const calm=matchMedia('(prefers-reduced-motion: reduce)');
let open=false,lastTopic=null,previousFocus=null,parked=false,motionPaused=calm.matches,ready=false;
try{parked=sessionStorage.getItem('ace-parked')==='yes';}catch{}
calm.addEventListener('change',e=>{motionPaused=e.matches;if(!motionPaused){state.ground=null;state.vy=0;nextDecision=clock+.8;}});

function addMessage(text,who,links=[],suggest=[]){const el=document.createElement('div');el.className='ace-message '+who;const label=document.createElement('span');label.className='speaker';label.textContent=who==='user'?'YOU':'LITTLE ACE';const p=document.createElement('p');p.textContent=text;el.append(label,p);if(links.length){const list=document.createElement('div');list.className='ace-message-links';for(const [title,href] of links){const a=document.createElement('a');a.textContent=title+' ↗';a.href=href;if(href.startsWith('https:')){a.target='_blank';a.rel='noopener';}list.append(a);}el.append(list);}
/* Some answers (the "are you asking a good question?" one) carry their own
   clickable follow-ups; each button simply asks its question. */
if(suggest&&suggest.length){const row=document.createElement('div');row.className='ace-msg-suggest';for(const s of suggest){const b=document.createElement('button');b.type='button';b.textContent=s;b.addEventListener('click',()=>ask(s,'chip'));row.append(b);}el.append(row);}
log.append(el);while(log.children.length>50)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;}
/* Keeps the glow on the latest thing he said: whenever the log changes, the last bot message that is not the typing dots gets .is-latest. */
new MutationObserver(()=>{const bots=log.querySelectorAll('.ace-message.bot:not(.ace-typing)'),last=bots[bots.length-1];log.querySelectorAll('.is-latest').forEach(e=>{if(e!==last)e.classList.remove('is-latest');});if(last&&!last.classList.contains('is-latest'))last.classList.add('is-latest');}).observe(log,{childList:true});
/* ── FLASHLIGHT BUTTONS ───────────────────────────────────────
   Two switches for the page's spade light (window.AceFlashlight, made by
   main.js): one beside the Ask Little Ace button, one beside Park Little
   Ace in the chat's footer. Only made where the light exists at all.
   The launcher one is positioned from the launcher's own box, so it stays
   beside it whatever width its label takes, and hides with it when the chat
   is open. */
const flashApi=window.AceFlashlight;
if(flashApi&&flashApi.available){
  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g class="ace-flash__rays"><path d="M12 1v2.6M6.4 2.6l1.5 1.8M17.6 2.6l-1.5 1.8"/></g><path d="M8.6 9.2 7.2 5.4h9.6l-1.4 3.8z"/><rect x="9" y="9.2" width="6" height="11.6" rx="1.3"/><rect class="ace-flash__sw" x="11.2" y="12.4" width="1.6" height="3.2" rx=".8" fill="currentColor" stroke="none"/></svg>';
  const make=cls=>{const b=document.createElement('button');b.type='button';b.className='ace-flash '+cls;b.setAttribute('aria-label','Spade flashlight');b.innerHTML=ICON;return b;};
  const beside=make('ace-flash--launcher');document.body.append(beside);
  const inChat=make('ace-flash--chat');
  const parkBtn=panel.querySelector('.ace-park');
  const group=document.createElement('div');group.className='ace-foot-btns';
  parkBtn.replaceWith(group);group.append(inChat,parkBtn);
  const both=[beside,inChat];
  flashApi.subscribe(on=>{for(const b of both){b.setAttribute('aria-pressed',String(on));b.classList.toggle('is-off',!on);b.title=on?'Spade flashlight: on. Click to turn it off':'Spade flashlight: off. Click to turn it on';}});
  for(const b of both)b.addEventListener('click',()=>flashApi.toggle());
  const place=()=>{
    const r=launcher.getBoundingClientRect();
    beside.hidden=launcher.hidden||!r.width;
    if(beside.hidden)return;
    beside.style.width=beside.style.height=r.height.toFixed(1)+'px';
    beside.style.right=(document.documentElement.clientWidth-r.left+8).toFixed(1)+'px';
  };
  place();addEventListener('resize',place);addEventListener('load',place);
  if(window.ResizeObserver)new ResizeObserver(place).observe(launcher);
  new MutationObserver(place).observe(launcher,{attributes:true,attributeFilter:['hidden']});
}
addMessage('Hi, I’m Little Ace, the guide to this site.\n\nHow to use me: type a question, or tap a suggestion.\nI’m not an AI or an LLM. I pick from answers written from this site’s pages.\nFor the best results, keep your questions short and simple, like “What does advisory cost?”\n\nFor anything personal, speak with Ace.','bot');

/* px/s^-1-ish ease rate he glides toward the chat-stand spot at, and the
   the rest between one play of the idle gesture ending and the next
   starting, re-rolled each time: never under MIN, never over MAX. */
const CHAT_EASE=6, CHATPOSE_MIN=5, CHATPOSE_MAX=13;
let nextChatPose=0,chatCloseTimer=null;

/* ── THE CHAT STANCE ─────────────────────────────────────────
   Beside the panel he is drawn as tall as the panel itself, roughly three
   times any other pose. Taking that from the atlas would mean upscaling a
   223px cell past 700px, and the gesture is all in his eyes — precisely
   what upscaling ruins. So this renders from its own sheet at the source
   art's native size, on its own canvas, fetched only when someone actually
   opens the chat. Geometry is printed by tools/build_atlas.py. */
const CHAT_CELL_W=704,CHAT_CELL_H=1456,CHAT_FIGURE_H=1400,CHAT_FIGURE_W=613;
const CHAT_FOOT_PAD=16;  // px of cell under his shoes
/* Daylight between his SILHOUETTE and the panel, not between the canvas
   and the panel — the cell carries empty space either side of him, so
   measuring the canvas edge would quietly understate the gap by that much
   again once it is scaled up. */
const CHAT_GAP=100;
/* The gesture is a GAZE CHANGE hidden behind a blink, which is how eyes
   actually redirect: he is looking at you, blinks, opens looking at the
   panel, holds it, blinks again and comes back to you.

   [cell, seconds] rather than one frame rate, because the two halves need
   opposite timings. A blink is ~200ms end to end — run it slower and he
   reads as falling asleep — while the look at the panel has to sit there
   long enough to be a look at all. A single fps cannot be both, which is
   what made the first cut of this read wrong at either speed.

   Cell index is the source frame index (see CHAT_ORDER in build_atlas.py):
   0/8 look at the viewer, 4 looks at the panel, 2/6 are shut, 3/5/7 are
   the lids on the way past. */
/* FORWARD AND BACK. One play goes through the gaze change and then the same
   frames in reverse, and it begins and ends on frame 0. Between plays he
   rests on frame 0 too, so there is no seam at either end — the old single
   pass ended on frame 8, whose eyes are set a little differently from the
   rest frame, and dropping from one to the other read as a glitch. 4, the
   look at the panel, is held on both legs. The turnaround at frame 8 is the
   other at-the-viewer frame. */
const CHAT_GESTURE=[
  [0,0.70],                      // rest frame; a play starts past this hold
  [5,0.06],[2,0.10],[3,0.06],    // blink, eyes redirect       ─┐ forward
  [4,1.60],                      // looking at the panel        │
  [7,0.06],[6,0.10],[5,0.06],    // blink back                  │
  [8,0.70],                      // at the viewer again        ─┘ turnaround
  [5,0.06],[6,0.10],[7,0.06],    // the same frames in         ─┐ backward
  [4,1.60],                      // reverse                     │
  [3,0.06],[2,0.10],[5,0.06],    // and round to rest          ─┘
];
const CHAT_GESTURE_LEN=CHAT_GESTURE.reduce((a,f)=>a+f[1],0);
/* A play skips the leading rest hold (he is already on that frame). */
const CHAT_LEAD=CHAT_GESTURE[0][1],CHAT_PLAY_LEN=CHAT_GESTURE_LEN-CHAT_LEAD;
/* Which cell the gesture is showing t seconds in, or -1 once it is done. */
function chatCellAt(t){
  for(const [cell,dur] of CHAT_GESTURE){if(t<dur)return cell;t-=dur;}
  return -1;
}
const chatCanvas=document.createElement('canvas');
chatCanvas.width=CHAT_CELL_W;chatCanvas.height=CHAT_CELL_H;
chatCanvas.className='ace-chat-pose';chatCanvas.setAttribute('aria-hidden','true');
pet.append(chatCanvas);
const chatCtx=chatCanvas.getContext('2d');
const chatImg=new Image();
let chatReady=false,chatAsked=false,lastChatCell=-1,chatGestureStart=-1;
/* The chat transform is tracked on its own rather than through state.x/y:
   those carry roaming semantics (centre, feet) against the small atlas
   cell, and none of that survives being three times the size on a
   different sheet. Seeded from his roam position on open and handed back
   on close, so the glide starts and ends where he actually is. */
let chatX=0,chatY=0,chatW='',chatH='';   // chatW/chatH: the canvas size last written, so an unchanged size is not rewritten every frame
function loadChatSheet(){
  if(chatAsked)return;
  chatAsked=true;
  chatImg.onload=()=>{chatReady=true;lastChatCell=-1;};
  chatImg.src=window.ACE_XMAS?'assets/images/ace-chat-pose-xmas.webp?v=6':'assets/images/ace-chat-pose.webp';
}
function renderChat(cell){
  if(!chatReady||cell===lastChatCell)return;
  lastChatCell=cell;
  chatCtx.clearRect(0,0,CHAT_CELL_W,CHAT_CELL_H);
  chatCtx.drawImage(chatImg,cell*CHAT_CELL_W,0,CHAT_CELL_W,CHAT_CELL_H,
                    0,0,CHAT_CELL_W,CHAT_CELL_H);
}
/* Sized so the FIGURE — not the cell, which carries padding above his cap
   and under his shoes — comes out exactly as tall as the panel, and placed
   with his feet on the panel's bottom edge, so the two line up top and
   bottom. The canvas sits bottom-anchored and centred inside `pet`, so
   `pet`'s bottom edge is the canvas's bottom edge and its centre is the
   canvas's centre; the returned x/y are the transform that puts it there. */
function chatLayout(){
  if(innerWidth<900||panel.hidden)return null;
  const r=panel.getBoundingClientRect();
  const h=r.height*CHAT_CELL_H/CHAT_FIGURE_H;   // cell height that makes the figure r.height tall
  const w=h*CHAT_CELL_W/CHAT_CELL_H;
  const footPad=CHAT_FOOT_PAD*h/CHAT_CELL_H;    // that padding, at display size
  const sidePad=(CHAT_CELL_W-CHAT_FIGURE_W)/2*w/CHAT_CELL_W;  // empty cell beside him
  return {w,h,
    x:r.left-CHAT_GAP+sidePad-w/2-SPRITE_W/2,   // his shoulder CHAT_GAP left of the panel
    y:r.bottom+footPad-SPRITE_H};               // his shoes on the panel's bottom edge
}
function showChat(){
 clearTimeout(chatCloseTimer);
 loadKnowledge().catch(()=>{});previousFocus=document.activeElement;open=true;panel.hidden=false;launcher.hidden=true;pet.classList.add('is-chatting');pet.setAttribute('aria-expanded','true');launcher.setAttribute('aria-expanded','true');shadow.style.opacity='0';input.focus({preventScroll:true});log.scrollTop=log.children.length>1?log.scrollHeight:0;   // a first opening starts at the top of the welcome, not the bottom
 /* Fresh schedule every time the chat opens, so the 15s cap counts from
    when he actually appears, not from some earlier session. */
 /* Only fetch the big sheet where he is actually drawn from it. Below
    900px he stays hidden, and a phone should not pay 900KB for a picture
    it will never show. */
 if(innerWidth>=900)loadChatSheet();
 chatGestureStart=-1;nextChatPose=clock+1.5+Math.random()*4;
 chatX=state.x-SPRITE_W/2;chatY=state.y-FEET_Y/2;   // glide starts where he is
 /* Unhide at the closed state (scale .82, opacity 0), force the browser to
    compute it, THEN flip to open — otherwise the transition has no prior
    value to animate from and the panel simply appears. Reading offsetHeight
    is what flushes that; it has to be a synchronous reflow rather than the
    usual double-requestAnimationFrame, because rAF is throttled to nothing
    in a background tab and the panel would then be stuck half-open until
    the tab was looked at again. */
 void panel.offsetHeight;
 panel.classList.add('is-open');scrim.classList.add('is-open');
}
function hideChat(){
 open=false;panel.classList.remove('is-open');scrim.classList.remove('is-open');launcher.hidden=false;pet.classList.remove('is-chatting');pet.setAttribute('aria-expanded','false');launcher.setAttribute('aria-expanded','false');(previousFocus?.isConnected?previousFocus:launcher).focus({preventScroll:true});
 /* Hand the chat transform back to the roaming state, so he carries on
    from where he was standing rather than snapping to wherever he was
    when the chat opened. */
 if(innerWidth>=900){state.x=chatX+SPRITE_W/2;state.y=chatY+FEET_Y/2;}
 state.x=clampX(state.x);if(state.y<0||state.y>innerHeight){state.y=innerHeight-70;state.ground=null;state.vy=0;}nextDecision=clock+1;
 /* The glide left him beside the panel, but state.ground still names
    whatever ledge he was on before the chat opened. Left alone, the roam
    loop snaps him back to that ledge's y for one frame before noticing he
    is off the end of it. Dropping the ground here makes him simply fall
    from where he is standing, which is what it looks like should happen. */
 state.ground=null;state.vy=0;
 clearTimeout(chatCloseTimer);
 /* Below 900px .is-open never did anything, so there is no shrink to wait
    out — hide at once, as this always did. At 900px+, give the CSS
    transition (.55s) time to finish before the panel is pulled from the
    accessibility tree out from under its own shrink. */
 if(innerWidth>=900)chatCloseTimer=setTimeout(()=>{panel.hidden=true;},580);
 else panel.hidden=true;
}
pet.addEventListener('click',showChat);launcher.addEventListener('click',showChat);close.addEventListener('click',hideChat);
/* Services without their own page (Advisory, Working Session, On-Site):
   their links open Little Ace, who points to the contact form. */
const ASK_TOPIC={onsite:'On-Site Assignments'};
document.addEventListener('click',e=>{const el=e.target.closest('.js-ace-ask');if(!el)return;e.preventDefault();
 const topic=ASK_TOPIC[el.dataset.aceTopic]||'that';
 if(!open)showChat();
 addMessage('To learn more about '+topic+', reach out to Ace and his Assistant with a little more information about your situation. The contact form is the best place to start.','bot',[['Contact form','contact.html']]);});panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hideChat();}});
/* One conversation per page load: the session remembers the topic, the
   visitor's name, business and budget, and rotates wordings (knowledge.js).
   The page itself is context — "how much is it?" on the poker page means
   the buy-in. */
let chat=null;
const PAGE_TOPIC={'aces-poker-night':'poker','aces-running-group':'running','all-aces-networking-events':'networking','premium-pickup-transport':'transport',
 'mastermind-membership':'MASTERMIND','mastermind-application':'MASTERMIND','public-speaking':'SPEAKING','private-working-session':'start','advisory':'ONGOING'};
const pageTopic=PAGE_TOPIC[(location.pathname.split('/').pop()||'').replace(/\.html$/,'')]||null;
/* A short "typing" pause, longer for longer answers, so replies arrive like
   someone wrote them rather than all at once. Skipped for reduced motion. */
let typingEl=null,typingTimer=0;
function showTyping(){typingEl=document.createElement('div');typingEl.className='ace-message bot ace-typing';typingEl.setAttribute('aria-label','Little Ace is typing');
 typingEl.innerHTML='<span class="speaker">LITTLE ACE</span><p><i></i><i></i><i></i></p>';log.append(typingEl);log.scrollTop=log.scrollHeight;}
/* ── CHAT LOG ──────────────────────────────────────────────────
   Each exchange is sent to a Google Sheet (tools/little-ace-log.gs) so the
   answers can be improved from what people actually ask. Anonymous: the
   chat ID is random per page load, and emails and phone numbers are replaced before anything leaves the browser. The send
   is fire-and-forget text/plain with no-cors — the only kind of request an
   Apps Script web app takes from another site without a preflight — so a
   failure never touches the chat.
   Flags mark likely misses: fallback (the "good question?" reply), noinfo
   (an answer still waiting on site info), missed (didn't understand),
   split (two questions answered in one), repeat (close to the last
   question — often a rephrase after a miss, sometimes just a follow-up). */
const LOG_URL='https://script.google.com/macros/s/AKfycbxr8aKMcIdB2LnibmgYvAwZpkmd7J_bCwomDTcYox6ZZE6hzLoQPVk8CI1Ez89iDLXAmQ/exec';
const LOG_VERSION='2026-09-27';
const chatId=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
let turn=0,lastQ='';
const scrubPII=t=>t.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,'[email]').replace(/(\+?\d[\d ().-]{7,}\d)/g,'[phone]');
/* The engine rotates its wording, so the flags match against every variant
   it can say rather than one sentence copied from it. */
let INTERIM=[],MISSED=[];
function startChat(){if(chat)return;chat=knowledge.createSession();INTERIM=(knowledge.LINES&&knowledge.LINES.interim)||[];MISSED=(knowledge.LINES&&knowledge.LINES.frustrated)||[];}
const says=(text,list)=>list.some(l=>text.includes(l));
const words=t=>new Set(t.toLowerCase().replace(/[^a-z0-9$ ]/g,' ').split(/\s+/).filter(w=>w.length>2));
function similar(a,b){const A=words(a),B=words(b);if(!A.size||!B.size)return false;let n=0;for(const w of A)if(B.has(w))n++;return n/(A.size+B.size-n)>=.6;}
function logTurn(q,a,source){
 const flags=[];
 if(a.id==='NONSENSE')flags.push('fallback');
 if(says(a.text,INTERIM))flags.push('noinfo');
 if(a.id==='FRUSTRATED'||says(a.text,MISSED))flags.push('missed');
 if(a.text.includes('\n\n'))flags.push('split');
 if(lastQ&&similar(q,lastQ))flags.push('repeat');
 lastQ=q;
 const body=JSON.stringify({chat:chatId,turn:++turn,page:location.pathname.split('/').pop()||'index.html',
  source,q:scrubPII(q).slice(0,600),id:a.id,flags:flags.join(' '),a:scrubPII(a.text).slice(0,1500),v:LOG_VERSION});
 try{fetch(LOG_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain'},body}).catch(()=>{});}catch{}
}
function ask(q,source='typed'){q=q.trim();if(!q)return;
 if(typingEl){clearTimeout(typingTimer);typingEl.remove();typingEl=null;}
 addMessage(q,'user');input.value='';input.focus({preventScroll:true});
 if(!knowledge){showTyping();
  loadKnowledge().then(()=>{if(typingEl){typingEl.remove();typingEl=null;}answer(q,source);},
   ()=>{if(typingEl){typingEl.remove();typingEl=null;}addMessage("Little Ace couldn't load his answers. Check your connection, then ask again.",'bot');});
  return;}
 answer(q,source);}
function answer(q,source){startChat();
 const a=chat.reply(q,{pageTopic});if(!a)return;
 logTurn(q,a,source);
 const wait=calm.matches?0:Math.min(1600,380+a.text.length*6);
 if(!wait){addMessage(a.text,'bot',a.links,a.suggest);return;}
 showTyping();
 typingTimer=setTimeout(()=>{if(typingEl){typingEl.remove();typingEl=null;}addMessage(a.text,'bot',a.links,a.suggest);},wait);}
panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();ask(input.value);});panel.querySelectorAll('.ace-chat-suggestions button').forEach(b=>b.addEventListener('click',()=>ask(b.textContent,'chip')));
/* Cheat codes: just the list, no descriptions. Keep it in step with the keydown handler (search SHIFT CODES). */
const CHEATS=['Shift + ACE','Shift + FLY','Shift + THOR','Shift + SANTA','Shift + SLIP'];
function updatePark(){parkButton.textContent=parked?'Let Little Ace roam':'Park Little Ace';}
parkButton.addEventListener('click',()=>{parked=!parked;try{sessionStorage.setItem('ace-parked',parked?'yes':'no');}catch{}updatePark();if(!parked){state.ground=null;state.vy=0;nextDecision=clock+.5;}});updatePark();
/* Christmas mode: a switch visitors can use, kept in this browser (localStorage "ace-xmas"). gate.js reads that choice
   before anything else loads, so a click saves it and reloads once to bring in the Christmas sheets and snow. The
   button shows whether Christmas is on now. */
const SNOW_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2.5v19M3.9 7.25l16.2 9.5M3.9 16.75l16.2-9.5"/><path d="M9.4 4.1 12 6.4l2.6-2.3M9.4 19.9 12 17.6l2.6 2.3"/></svg>';
const xmasButton=panel.querySelector('.ace-xmas');
xmasButton.innerHTML=SNOW_ICON;
function updateXmas(){const on=!!window.ACE_XMAS;xmasButton.setAttribute('aria-pressed',String(on));xmasButton.classList.toggle('is-off',!on);xmasButton.title=on?'Christmas mode: on. Click to turn it off':'Christmas mode: off. Click to turn it on';}
updateXmas();
xmasButton.addEventListener('click',()=>{const on=!window.ACE_XMAS;try{localStorage.setItem('ace-xmas',on?'on':'off');sessionStorage.removeItem('ace-xmas-t0');sessionStorage.removeItem('ace-xmas-stuck');}catch(e){}location.reload();});
/* THE BLIZZARD (Christmas mode only): a second small button beside the Christmas switch. It closes the chat so the page
   is in view and asks xmas.js to blow a storm (window.AceSnow.blizzard). When the pile reaches full xmas.js fires
   'ace:snowfull' and Little Ace is left STUCK in the snow for the rest of the visit: he stops roaming, stands on the
   floor and holds one frame (the clips 'stuck', an eight-frame arm-waving loop, and now and then 'shiver', both from ace-stuck-xmas.webp).
   He can be dragged out and set on top of the snow (see floorLift); he sinks back in slowly. Turning Christmas off or on
   again with the switch above frees him for good. */
let stuck=false;
/* Dragged out of the snow he is set down ON TOP of it: for as long as floorLift is above zero the floor under him is the
   top of the snow (SNOW_TOP px above the bottom of the window, about where xmas.js's front lip ends), so he lands and runs
   about up there. While he is on that floor floorLift falls by SINK_PX_S a second: he slowly sinks back in, and when it
   reaches zero he is stuck again. Standing on a ledge he does not sink. Big moments wait until he is down. */
let floorLift=0;
let nextShiver=0,shiverUntil=0;   // buried: every so often he stops waving and shivers for a few seconds
const SNOW_TOP=60,SINK_PX_S=1.5;   // SNOW_TOP: the drift's top before it was raised; below this he is stuck on the bottom
const snowTop=()=>window.AceSnow&&AceSnow.top?AceSnow.top():SNOW_TOP*(innerWidth<600?.8:1)*Math.min(1,innerHeight/800);   // top of the drift now (xmas.js)
const snowLift=()=>snowTop()-16;
/* Stuck: he is lowered into the drift until its top reaches the spade on his coat (SPADE_H px above his feet, at the
   sprite's display scale). The floor follows the snow as it piles, and never sits higher than the usual 16px. */
const SPADE_H=55;
const stuckLift=()=>Math.min(0,snowTop()-SPADE_H-16);
const floorY=()=>innerHeight-16-floorLift;
let slip=null,slipRot=0,nextSlip=0,slipWant=false;   // see SLIPPING
const STUCK_KEY='ace-xmas-stuck';
try{if(window.ACE_XMAS&&sessionStorage.getItem(STUCK_KEY)==='1')stuck=true;else sessionStorage.removeItem(STUCK_KEY);}catch(e){}
if(window.ACE_XMAS){
  const bzButton=document.createElement('button');bzButton.type='button';bzButton.className='ace-blizzard';
  bzButton.setAttribute('aria-label','Blizzard');bzButton.title='Blizzard: whip up a snowstorm';
  bzButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/></svg>';
  xmasButton.after(bzButton);
  bzButton.addEventListener('click',()=>{hideChat();if(window.AceSnow&&window.AceSnow.blizzard)window.AceSnow.blizzard();});
}
document.addEventListener('ace:snowfull',()=>{
  if(!window.ACE_XMAS||stuck)return;
  const hold=setInterval(()=>{if(power||sleigh||flight||summon)return;clearInterval(hold);stuck=true;try{sessionStorage.setItem(STUCK_KEY,'1');}catch(e){}},300);   // wait for a big moment to finish first
});

/* ── SPRITE ────────────────────────────────────────────────────
   The atlas is a uniform grid, built offline by
   scratchpad/build_atlas.py from the three source sheets. Two things
   were done there that used to be done here, badly:

   * the magenta is already keyed to alpha, so this no longer reads back
     a two-megabyte image pixel by pixel on every page load;
   * every frame is FEET-ALIGNED inside its cell — the lowest pixel sits
     on the cell floor and the centre of the feet sits on the cell's
     centre line. So a cell can be blitted whole, and a pose that throws
     an arm out no longer shunts the body sideways, which is what
     anchoring on a per-frame bounding box used to do.

   Frames are grouped into named clips with their own frame rates, rather
   than one global "advance every 100ms". A run needs to read as a run;
   an idle should barely move. */
const CELL_W=240,CELL_H=280,ATLAS_COLS=8;
const FEET_Y=273;                 // where the feet sit inside a cell
const SPRITE_W=CELL_W/2,SPRITE_H=CELL_H/2;   // CSS px; the canvas is 2x this

/* dir: which way the artwork already faces, so the renderer knows when to
   mirror. Every side-on pose in the run/jump sheet faces RIGHT — the cap
   brim, the eyes and the leading knee all point that way — so dir is +1 and
   he is mirrored when travelling left. 0 means the pose reads the same
   either way (the front-on idle and wave) or must never be mirrored (the
   climb, which is drawn from behind). */
const CLIPS={
  /* Idle, cells 0-7: eight frames from the painterly sheet. 3 and 7 are the
     blinks, 4-6 the side glances. 3.8fps gives a 2.1s loop. */
  idle  :{f:[0,1,2,3,4,5,6,7],       fps:3.8,loop:true, dir:0},
  /* Stuck in the blizzard's snow (Christmas): for now just his idle frame, held. */
  stuck :{f:[0,1,2,3,4,5,6,7],         fps:8,  loop:true, dir:0},   // cells of ace-stuck-xmas.webp, not of the atlas (see renderSprite)
  /* Now and then, buried: arms crossed, teeth chattering (cells 8-13 of the same strip). */
  shiver:{f:[8,9,10,11,12,13],         fps:24, loop:true, dir:0},
  /* Wave: eight frames (cells 8-12, then 83-85): hand up, wave, hand down. */
  wave  :{f:[8,9,10,11,12,83,84,85], fps:10, loop:true, dir:0},
  /* A real eight-frame gait, played whole and in order at 11fps — the
     planted foot genuinely swings from ahead of the hips to behind them
     across the sheet. The rear shoe is missing from frame 6 as generated;
     build_atlas.py reads the repaired run-cycle-8.png. */
  run   :{f:[13,14,15,16,17,18,19,20],fps:11,loop:true,dir:1},
  crouch:{f:[21,22,23],              fps:16, loop:false,dir:1 },
  rise  :{f:[24,25],                 fps:10, loop:false,dir:1 },
  apex  :{f:[26,27],                 fps:7,  loop:true, dir:1 },
  fall  :{f:[28,29],                 fps:9,  loop:true, dir:1 },
  land  :{f:[30,31,32,33],                 fps:17, loop:false,dir:1 },
  /* Back-view climb strip: he faces the wall, so dir:0 — never mirrored. */
  climb :{f:[34,35,36,37,38,39,40,41],fps:11,loop:true, dir:0},
  /* He points DOWN at the button under his feet, so there is no left or
     right to it — dir:0 keeps it from ever being mirrored. Nine frames at
     6.75fps lean in (cell 86 is the in-between from standing into the lean),
     point, and straighten up again in 1.3s; the clip is a
     one-shot, so it then holds the plain stand it ends on. */
  point :{f:[42,86,43,44,45,46,47,48,49],fps:6.75,loop:false,dir:0},
  /* Slipping off a button (Christmas only, see SLIPPING below): cells 80, 88, 81, 82 of the atlas are the wobble (standing with his
     hands in his pockets, a first lean, arms out as his feet go, tipping back) and cell 87 is the last frame, him tipped right over, which is held and spun while he falls.
     The art leans to screen-right, so dir:1: he is mirrored when he falls to the left. */
  slip  :{f:[80,88,81,82],fps:7,loop:false,dir:1},
  slipfall:{f:[87],fps:1,loop:true,dir:1},
  /* The other point: arm up, finger to the sky, for when he is standing on
     something (a tray, a card) with a button overhead. Six drawn frames,
     1 = the plain stand and 6 = arm fully up; played 1-6, held at the peak
     for three beats, then 6-1 back to the stand: 14 steps at 8fps = 1.75s,
     inside POINT_HOLD. dir:0, never mirrored (the raised arm is his right). */
  pointup:{f:[63,64,65,66,67,68,68,68,68,67,66,65,64,63],fps:8,loop:false,dir:0},
  /* Held up by the hood. Not played on a clock: the frame is chosen from how
     the hand is moving (dragPoseNow below), so fps is unused and clipFrame()
     special-cases it. Thirteen frames in swing order, left to right: 0-3 swung to the LEFT of the
     hood (0 furthest), 4-6 hanging straight (6 is a happy blink), 7-10 a little
     to well RIGHT, 11-12 swung furthest right. dir:0 because it
     swings both ways on its own and must never be mirrored. */
  drag  :{f:[50,51,52,53,54,55,56,57,58,59,60,61,62],fps:0,loop:false,dir:0},
};
/* Vertical bounce while running, in CSS px. The cycle carries its own rise
   and fall now, so this is a light garnish rather than the load-bearing
   trick it was when the run was four near-identical poses. */
const RUN_BOB=1.5;
// Tied to the run clip's cadence on purpose. The cycle covers one stride
// per CLIPS.run.f.length frames, so travel has to scale with fps or the
// feet skate: at 11fps he strides 1.375x/s, and 142px/s keeps roughly the
// 103px-per-stride the sheet is drawn for.
const RUN_SPEED=142;

const img=new Image();const ctx=canvas.getContext('2d');
let clipName='idle',clipStart=0,lastCell=-1,lastFlip=null,dragPose=0;
/* He arrives standing on his own Ask Little Ace button and waves hello for
   WAVE_HOLD seconds before he does anything else. The hold is what makes the
   wave visible at all: the clip picker runs every frame, and without it the
   standing branch swapped the wave for idle on the very next one. */
const WAVE_HOLD=1.7;
img.onload=()=>{
  ready=true;pet.classList.remove('ace-loading');
  pet.classList.add('intro');setTimeout(()=>pet.classList.remove('intro'),6500);
  const spot=launcherSurface();
  if(spot){state.x=(spot.left+spot.right)/2;state.y=spot.y;state.vx=state.vy=0;state.ground='launcher';}
  waveUntil=clock+WAVE_HOLD;nextDecision=waveUntil+.6;
  play('wave');
};
img.onerror=()=>{pet.hidden=true;shadow.hidden=true;};
/* WebP, not the PNG the build writes: 435KB against 1.8MB, with the alpha
   identical and colour within ~1.5/255 on average. Re-export after a rebuild. */
img.src=window.ACE_ATLAS||'assets/images/ace-atlas.webp?v=14';   // bump when the sheet changes: the page caches it

/* The buried "Ahh!" loop (Christmas only) has its own six-cell strip, loaded once; until it arrives he holds his idle frame. */
let stuckImg=null,stuckReady=false;
if(window.ACE_XMAS){stuckImg=new Image();stuckImg.onload=()=>{stuckReady=true;lastCell=-1;};stuckImg.src='assets/images/ace-stuck-xmas.webp?v=6';}

function play(name){if(clipName!==name){clipName=name;clipStart=clock;}}
/* Where a clip has got to. A looping clip wraps; a one-shot holds its last
   frame, which is what makes `point` read as a held gesture rather than a
   flick. */
function clipFrame(){
  const c=CLIPS[clipName]||CLIPS.idle;
  if(clipName==='drag')return c.f[dragPose];   // posed by hand, not by time
  const n=Math.floor((clock-clipStart)*c.fps);
  return c.f[c.loop?n%c.f.length:Math.min(n,c.f.length-1)];
}
/* The idle's glance: the only frames in it that turn his head, and the art
   turns it to screen-right. On the right half of the page that is the
   scrollbar, so there they are mirrored to look back across the page. The
   rest of the idle faces front and is never mirrored. Mirrored about his
   legs (LEGS_X in cell px, where every idle frame is aligned) rather than
   the cell centre, or he would hop ~5px sideways every glance. */
const IDLE_LOOK=new Set([3,4,5]),LEGS_X=115;
/* The spade on his jacket is on his right chest (screen-right), so a frame that is simply mirrored would put it on the wrong
   side. The frames where it shows (the idle glances and the slip) have a ready-made mirrored copy in the atlas, in row 12,
   with the spade rubbed out on the wrong side and put back on the right one: they are drawn as they are, not flipped. */
const MIRROR_CELL={3:96,4:97,5:98,80:99,88:100,81:101,82:102,87:103};
function renderSprite(facing){
  if(!ready)return;
  const cell=clipFrame();
  const dir=(CLIPS[clipName]||CLIPS.idle).dir;
  const look=clipName==='idle'&&IDLE_LOOK.has(cell)&&state.x>innerWidth/2;
  const flip=(dir!==0&&facing!==dir)||look;
  const own=(clipName==='stuck'||clipName==='shiver')&&stuckReady;      // drawn from the stuck strip instead of the atlas
  const mc=(!own&&(flip||look))?MIRROR_CELL[cell]:undefined;     // a ready-made mirrored copy, if there is one
  const key=own?100+cell:(mc!==undefined?200+mc:cell);
  if(key===lastCell&&flip===lastFlip)return;   // nothing changed, skip the blit
  lastCell=key;lastFlip=flip;
  const dc=mc!==undefined?mc:cell;
  const sx=own?cell*CELL_W:(dc%ATLAS_COLS)*CELL_W,sy=own?0:Math.floor(dc/ATLAS_COLS)*CELL_H;
  ctx.clearRect(0,0,CELL_W,CELL_H);
  ctx.save();
  if(mc!==undefined){}
  else if(look){ctx.translate(LEGS_X*2,0);ctx.scale(-1,1);}
  else if(flip){ctx.translate(CELL_W,0);ctx.scale(-1,1);}
  ctx.drawImage(own?stuckImg:img,sx,sy,CELL_W,CELL_H,0,0,CELL_W,CELL_H);
  ctx.restore();
}

/* ── WHAT HE CAN STAND ON ──────────────────────────────────────
   Found rather than listed. A hand-written class list goes stale the
   moment the site gains a section, and it misses the obvious things —
   buttons, the hairline rules between blocks, the underside of a tray.
   So this asks the page directly: which elements actually draw a
   horizontal edge a small person could stand on?

   An edge counts when something is painted along it — a border, or the
   silhouette of a filled box against the page behind it. Each element
   can contribute two ledges, its top and its bottom, because the site
   draws lines on both (a tray's base rule is as real as its lid).

   Read once at load, not per frame: this is a static site, the answer
   does not change, and one pass of getComputedStyle over the document
   is affordable where hundreds per second would not be. */
const PERCH_MIN_WIDTH=90;   // narrower than this and there is nowhere to land
const PERCH_MIN_GAP=20;     // two ledges closer than this read as one

function findPerches(){
  const out=[];
  const all=document.body.querySelectorAll('*');
  for(const el of all){
    /* Chrome is out: the fixed header, the mobile menu, the footer, his
       own chat panel — and himself, since the canvas he is drawn on is a
       filled box like any other and he would otherwise stand on his own
       head. So is the home hero's copy: those blocks are transparent
       until the scroll choreography composes them, and he should not be
       standing on a button nobody can see yet. The skip link is parked
       off-screen at left:-9999px until it takes focus. */
    if(el.closest('.site-head,.mnav,.foot,#ace-chat,.sprite,.skip,.portrait__cap,'+
                  '.ace-companion,.ace-shadow,.ace-launcher,[data-hero] .hero__content'))continue;
    /* Nothing inside the hero is a ledge (its video, its stage, its box): the bottom edge is just where the picture ends, with no line drawn
       there, so he looked like he was running on air along the foot of the video. */
    if(el.closest('.hero'))continue;
    const r=el.getBoundingClientRect();
    /* No minimum height: a horizontal rule is the flattest thing on the
       page and one of the most obviously walkable. Only zero is out. */
    if(r.width<PERCH_MIN_WIDTH||r.height<=0)continue;

    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility!=='visible'||cs.position==='fixed')continue;
    /* Decorative overlays are not ledges. pointer-events:none is the page
       saying "this is scenery, not a thing" — it catches the grain, the
       hero scrim, the page spade, and the .alsotile__bloom layers, which
       are full-size boxes sitting invisibly over the tiles. Anything
       already transparent is out for the same reason. */
    if(cs.pointerEvents==='none'||parseFloat(cs.opacity)<.15)continue;

    const drawn=s=>parseFloat(s)>0;
    const painted=cs.backgroundImage!=='none'||
      (cs.backgroundColor!=='transparent'&&!/rgba\(.*,\s*0\)$/.test(cs.backgroundColor));
    // A picture, a rule or a control is an edge all by itself.
    const solid=painted||el.tagName==='IMG'||el.tagName==='HR'||el.tagName==='CANVAS'||
      el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT';
    /* Interior hairlines — the dividers between a card's spec rows — count
       too. They are drawn, they are horizontal, and they are what he
       climbs: a pricing card is 850px tall, so without the rungs inside it
       the only way up from the floor is one absurd leap. He does end up
       standing in front of some copy, which is the nature of a character
       walking on a page rather than a fault. */
    if(solid||drawn(cs.borderTopWidth))out.push({el,edge:'top',y:r.top+scrollY,left:r.left,right:r.right});
    /* Undersides only for things big enough that the base rule reads as a
       separate ledge. On a button the two edges are 50px apart and he
       would just be hopping between the top and bottom of the same
       object. */
    if((solid||drawn(cs.borderBottomWidth))&&r.height>110)out.push({el,edge:'bottom',y:r.bottom+scrollY,left:r.left,right:r.right});
  }

  /* Collapse near-duplicates. A bordered card inside a bordered tray with
     a background of its own can offer three ledges within a few pixels;
     keeping all of them makes him twitch between them. Document
     coordinates, because the geometry between elements never changes —
     only the whole page's offset does. */
  out.sort((a,b)=>a.y-b.y);
  const kept=[];
  for(const p of out){
    /* kept is in y order and nothing in it is below p, so only its tail can be
       within PERCH_MIN_GAP: walk back from the end and stop at the first ledge
       that is already too far above. */
    let dupe=false;
    for(let i=kept.length-1;i>=0;i--){
      const k=kept[i];
      if(p.y-k.y>=PERCH_MIN_GAP)break;
      if(Math.min(k.right,p.right)-Math.max(k.left,p.left)>Math.min(k.right-k.left,p.right-p.left)*.8){dupe=true;break;}
    }
    if(!dupe)kept.push(p);
  }
  return kept;
}

const perches=findPerches();
window.AcePerches=perches;   // read-only: xmas.js lays snow on these ledges and hangs icicles off the boxes
/* A button is a ledge like any other, but it is also the one thing on the
   page worth drawing attention to — see the pointing behaviour below. */
const BUTTONISH='.btn,button,.copy,.tier__cta,.circle__link';
for(const p of perches)p.button=p.edge==='top'&&p.el.matches(BUTTONISH);

/* ── CLIMBABLE COPY ────────────────────────────────────────────
   Headings and paragraphs are not ledges: nothing is drawn along their
   top edge, and standing on one would read as floating over the words.
   But they are the only thing on a page that is nothing but prose, and a
   companion who can only pace the bottom of the window there is a dull
   one. So they are collected separately: he cannot jump to them, he can
   only climb them, hand over hand, and stand on top when he arrives. */
function findClimbables(){
  const out=[];
  for(const el of document.body.querySelectorAll('h1,h2,h3,p,li,blockquote')){
    if(el.closest('.site-head,.mnav,.foot,#ace-chat,.ace-companion,[data-hero] .hero__content,.tier__price,.tier__name,.btn,button'))continue;   // not the copy inside cards: he looked stuck on their sides
    if(el.querySelector('h1,h2,h3,p,li'))continue;      // containers, not text
    if(!el.textContent.trim())continue;
    const r=el.getBoundingClientRect();
    if(r.width<120||r.height<18)continue;
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility!=='visible'||parseFloat(cs.opacity)<.15)continue;
    out.push({el});
  }
  return out;
}
const climbables=findClimbables();

/* Debug marker only — nothing reads it back. An element can carry two
   ledges, so the value lists both rather than the second silently
   overwriting the first. */
for(let i=0;i<perches.length;i++){const d=perches[i].el.dataset;
  d.acePerch=(d.acePerch?d.acePerch+' ':'')+i+':'+perches[i].edge;}
let surfaces=[],clock=0,last=0,nextDecision=1.8,lastSurfaceUpdate=-1,scroll=scrollY,landingUntil=0,crouchUntil=0,pendingJump=null,target=null,facing=-1,runGoal=null;
/* climb: {el, x} while he is going up a block of copy.
   textSurface: the block he climbed, standable for as long as he is on it.
   pointUntil: how long he holds the point once he has landed on a button. */
let climb=null,textSurface=null,pointUntil=0,waveUntil=0,pointKind='point';   // pointKind: 'point' (down at the button he is on) or 'pointup'
/* ── A SCRIPTED VISIT ─────────────────────────────────────────
   The home hero's intro (heroIntro() in main.js) sends him to stand on a
   word and point at it: window.AceCompanion.visit(el,{onPoint,onLeave}).
   While it runs the decision loop is off, the word's top edge is a surface
   he can land on, and the two leaps are solved here rather than by
   physics.jump(), whose 340px/s cap is sized for hops between neighbouring
   ledges and would drop him short of a word across the screen. It resolves
   true once he is back on his button, or false if he could not go (not
   loaded, parked, chatting, being carried) or it ran long. */
let visit=null;
const VISIT_POINT=1.6;   // s he points at the word; the point clip itself is 1.3s
function visitSurface(){
  if(!visit||visit.phase==='back')return null;
  const r=visit.el.getBoundingClientRect();
  if(!r.width)return null;
  return {id:'visit',left:r.left-30,right:r.right+30,y:r.top};
}
function leap(tx,ty){
  const g=physics.GRAVITY,rise=state.y-ty;
  const clear=Math.max(60,Math.min(190,ty-90));        // keep the top of the arc on screen
  const vy=-Math.sqrt(2*g*(Math.max(0,rise)+clear));
  const time=(-vy+Math.sqrt(Math.max(0,vy*vy+2*g*(ty-state.y))))/g;
  state.vy=vy;state.vx=(tx-state.x)/Math.max(.3,time);state.ground=null;
  facing=Math.sign(state.vx)||facing;
}
function endVisit(ok){
  if(!visit)return;
  const v=visit;visit=null;nextDecision=clock+1.2;scan();v.res(ok);
}
window.AceCompanion={
  visit(el,opts){
    return new Promise(res=>{
      if(!ready||open||parked||motionPaused||dragging||!el){res(false);return;}
      visit={el,phase:'start',onPoint:opts&&opts.onPoint,onLeave:opts&&opts.onLeave,res,until:clock+9};
      climb=null;runGoal=null;pendingJump=null;waveUntil=0;pointUntil=0;scan();
    });
  },
  /* Where he is right now, read-only: centre x and feet y in viewport px, his drawn height, whether he is in the
     air and falling, and whether he is on the way back from a visit. The waitlist gate uses it to hand him over
     to the Little Ace running behind the gates at the very spot he will run in. */
  where(){
    return {x:state.x,y:state.y,h:SPRITE_H,airborne:state.ground===null,vy:state.vy,vx:state.vx,
            returning:!!(visit&&visit.phase==='back')};
  },
  /* Show a thought bubble now (the next line from THOUGHTS, or the text or {t,href} given). For trying it out. */
  think(line){think(line);}
};
const state={x:Math.max(70,innerWidth-160),y:innerHeight-20,vx:0,vy:0,ground:'floor'};
let cursorX=innerWidth/2;document.addEventListener('pointermove',e=>{cursorX=e.clientX;},{passive:true});

/* ── THOUGHTS ──────────────────────────────────────────────────
   At a random moment 20 to 45 seconds after the last one went away (thinkGap; time only counts while the page is on
   screen, see thinkClock below), a thought bubble rises over his head
   for a few seconds and follows him while it is up. THOUGHTS is the list
   it works through: a plain string is a joke, {t,href} is a line that links to a
   page, {t,xmas:true} only shows at Christmas. It carries on through the list from page to page (ACE_THOUGHT_KEY), starting
   somewhere random, and skips a link to the page you are already on. It holds off while the chat is
   open, while he is being dragged, while the waitlist gate is up and
   while the home intro plays, and tries again a few seconds later.
   A joke is decorative, so it is hidden from screen readers. A link is a real link: while the pointer
   or keyboard focus is on it the bubble stops following him and stays up, so it can be clicked. */
const THOUGHTS=[
  {t:'One problem. One meeting with Ace. That’s a Private Working Session.',href:'private-working-session.html'},
  'Ace has meetings. I have buttons.',
  {t:'Want Ace in your corner every month? Ask about Ongoing Private Advisory.',href:'advisory.html'},
  {t:'Mastermind members get monthly meetings and, depending on the tier, direct time with Ace.',href:'mastermind-membership.html'},
  'I’ve been running for hours and I’m still here.',
  {t:'Airport run? Investor meeting? Ace can get you there on time, in your style.',href:'premium-pickup-transport.html'},
  {t:'Ace talks resilience, personal development and networking. Book him for your room.',href:'public-speaking.html'},
  {t:'Who keeps shovelling snow onto this website?',xmas:true},
  'Please stop throwing me. …Okay, one more.',
  {t:'Two roads and no idea which one to take? A Private Working Session is $500 CAD.',href:'private-working-session.html'},
  {t:'Got something that needs fixing? Start the Conversation with Ace.',href:'contact.html'},
  {t:'There’s a private, application-only group called the Invested Aces Mastermind. Join them.',href:'mastermind-membership.html'},
  {t:'Personal or business? Ace doesn’t make you pick. Ongoing Private Advisory from Ace is currently undervalued.',href:'advisory.html'},
  {t:'Need an arrival that carries some weight? Ace drives. Premium Pickup & Transport.',href:'premium-pickup-transport.html'},
  {t:'Need a speaker with a memorable presence? Book Ace before it\'s too late.',href:'public-speaking.html'},
  {t:'You can apply to the Invested Aces Mastermind right here.',href:'mastermind-application.html'},
  {t:'Need the unfiltered report on a team, a location or an opportunity? Ask about On-Site Assignments.',href:'contact.html'},
  {t:'Not sure where to start? Everything starts with a 30-minute assessment call.',href:'contact.html'},
  'Press Shift + ACE and see what happens.',
  'Press Shift + FLY and see what happens.',
  {t:'Press Shift + THOR and see what happens.',normal:true},
  'Press Shift + SANTA and see what happens.',
  {t:'Press Shift + SLIP and see what happens.',xmas:true},
].map(l=>typeof l==='string'?{t:l}:l).filter(l=>(!l.xmas||window.ACE_XMAS)&&(!l.normal||!window.ACE_XMAS)&&(!l.href||l.href.split('#')[0]!==(location.pathname.split('/').pop()||'index.html')));
const THINK_GAP_MIN=20,THINK_GAP_MAX=45,thinkGap=()=>THINK_GAP_MIN+Math.random()*(THINK_GAP_MAX-THINK_GAP_MIN),THINK_FOR=7,THINK_LINK_FOR=11,ACE_THOUGHT_KEY='ace-thought';
const bubble=document.createElement('div');bubble.className='ace-think';bubble.setAttribute('aria-hidden','true');
bubble.innerHTML='<p></p><i class="ace-think__dot ace-think__dot--a"></i><i class="ace-think__dot ace-think__dot--b"></i><i class="ace-think__tear ace-think__tear--a"></i><i class="ace-think__tear ace-think__tear--b"></i>';
document.body.append(bubble);
/* Its own clock, in real seconds the page is on screen. Little Ace's `clock` caps each frame's step, so on a
   slow or busy device it runs behind the wall clock and "every five minutes" would stretch. Time with the tab
   hidden is left out (the clock restarts from the moment it is shown again), and any single gap counts for at
   most five seconds, so a sleeping laptop does not fast-forward it. */
let thinkClock=0,thinkLast=0;
document.addEventListener('visibilitychange',()=>{thinkLast=0;});
let nextThought=thinkGap(),thinkUntil=-1;
let thoughtIx=Math.floor(Math.random()*THOUGHTS.length);
try{const n=parseInt(sessionStorage.getItem(ACE_THOUGHT_KEY),10);if(n>=0)thoughtIx=n;}catch(e){}
const ACE_T=s=>window.ACE_TR?window.ACE_TR(s):s;   /* the translated line, when the page is in another language */
function think(line){
  if(typeof line==='string')line={t:line};
  if(!line){line=THOUGHTS[thoughtIx++%THOUGHTS.length];try{sessionStorage.setItem(ACE_THOUGHT_KEY,String(thoughtIx%THOUGHTS.length));}catch(e){}}
  const p=bubble.querySelector('p');p.textContent='';
  if(line.href){const a=document.createElement('a');a.href=line.href;a.textContent=ACE_T(line.t);p.append(a);bubble.removeAttribute('aria-hidden');}
  else{p.textContent=ACE_T(line.t);bubble.setAttribute('aria-hidden','true');}
  bubble.classList.toggle('has-link',!!line.href);
  bubble.classList.toggle('is-red',Math.random()<THINK_RED);bubble.classList.remove('is-glitch');
  nextGlitch=thinkClock+.6+Math.random();
  thinkUntil=thinkClock+(line.href?THINK_LINK_FOR:THINK_FOR);placeBubble();bubble.classList.add('is-on');
}
/* Now and then the edge of the bubble tears for a third of a second (.is-glitch in companion.css): the bars land somewhere new each time. */
const THINK_RED=.25,glitchRand=(a,b)=>a+Math.random()*(b-a);
let nextGlitch=0,glitchOff=0;
function glitchBubble(){
  for(const t of bubble.querySelectorAll('.ace-think__tear')){t.style.setProperty('--y',glitchRand(10,82)+'%');t.style.setProperty('--w',glitchRand(20,32)+'px');t.style.setProperty('--h',glitchRand(2,5)+'px');}
  bubble.classList.remove('is-glitch');void bubble.offsetWidth;bubble.classList.add('is-glitch');
  clearTimeout(glitchOff);glitchOff=setTimeout(()=>bubble.classList.remove('is-glitch'),360);
}
let thinkHeld=false;   // the pickup line: stays up while he is being carried
function quiet(){thinkUntil=-1;thinkHeld=false;bubble.classList.remove('is-on','has-link','is-glitch');bubble.setAttribute('aria-hidden','true');}
/* Up and to his right, off the top of his cap; to his left where the right side has no room. */
function placeBubble(){
  const w=bubble.offsetWidth,h=bubble.offsetHeight,head=state.y-FEET_Y/2;
  const left=state.x>innerWidth-w-70;
  bubble.classList.toggle('is-left',left);
  let x=left?state.x-24-w:state.x+24,y=head-h+4;
  x=Math.max(8,Math.min(innerWidth-w-8,x));y=Math.max(70,y);
  bubble.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
}
// started on the next frame, not now: `dragging` is declared further down this file
requestAnimationFrame(function thinkLoop(now){
  if(thinkLast&&!document.hidden)thinkClock+=Math.min(5,(now-thinkLast)/1000);
  thinkLast=now;
  const html=document.documentElement;
  const busy=!ready||open||dragging||html.classList.contains('gate-locked')||html.classList.contains('intro');
  const held=bubble.classList.contains('has-link')&&(bubble.matches(':hover')||bubble.contains(document.activeElement));   // being read or clicked: it stays up and stays put
  if(thinkUntil>=0){if((busy&&!(thinkHeld&&dragging))||(thinkClock>=thinkUntil&&!held)){quiet();nextThought=thinkClock+thinkGap();}else{if(!held)placeBubble();if(thinkClock>=nextGlitch){glitchBubble();nextGlitch=thinkClock+glitchRand(1.2,3.8);}}}
  else if(thinkClock>=nextThought){if(busy)nextThought=thinkClock+5;else think();}
  requestAnimationFrame(thinkLoop);
});

/* ── PACE ─────────────────────────────────────────────────────
   He takes his energy from the visitor. While they are moving (pointer,
   scroll, wheel, keys, touch within ACTIVE_WINDOW seconds) he is busy:
   quick decisions, more hops and climbs. Once they stop he keeps going for
   SETTLE_MOVES more moves at a calmer pace, then rests in the idle stance
   for REST_MIN-REST_MAX seconds, takes a short wander of one or two moves,
   and rests again — for as long as they stay put. Moving again wakes him
   straight away (see the decision call in tick).

   Bounded by time as well as by count: one climb or a run across the page
   can take several seconds, so three "settling" moves could otherwise fill
   the whole pause and he would never come to rest. New moves only start
   within SETTLE_SECS of the visitor stopping, or within WANDER_SECS of a
   rest ending; whatever he is already doing still finishes. */
const ACTIVE_WINDOW=1.2,SETTLE_MOVES=3,SETTLE_SECS=4,REST_MIN=2.5,REST_MAX=5,WANDER_SECS=3;
let lastActive=0,movesLeft=SETTLE_MOVES,wanderUntil=0;
const markActive=()=>{lastActive=clock;};
for(const ev of ['pointermove','scroll','wheel','keydown','touchstart'])addEventListener(ev,markActive,{passive:true});
function busy(){return clock-lastActive<ACTIVE_WINDOW;}
function decide(){
  if(busy()){movesLeft=SETTLE_MOVES;choose(true);nextDecision=Math.min(nextDecision,clock+.5+Math.random()*.9);return;}
  const open=Math.max(lastActive+ACTIVE_WINDOW+SETTLE_SECS,wanderUntil);
  if(movesLeft>0&&clock<open){movesLeft--;choose(false);nextDecision=Math.min(nextDecision,clock+1.4+Math.random()*1.4);return;}
  nextDecision=clock+REST_MIN+Math.random()*(REST_MAX-REST_MIN);   // stand in idle
  movesLeft=Math.random()<.5?1:2;                                   // then a short wander
  wanderUntil=nextDecision+WANDER_SECS;
}

/* ── BEING CARRIED ───────────────────────────────────────────
   He is a button first, so a press stays a click until it travels far
   enough to be a drag. Past DRAG_SLOP the pointer owns him outright: the
   decision loop, the physics and any climb in progress are all skipped,
   and the frame comes from how fast the hand is moving rather than from a
   clock. Letting go clears his ground so physics.step picks him up on the
   next frame and he falls to whatever is beneath him.

   The listeners live on window rather than on him. Pointer capture is only
   taken once the drag is real, and a fast flick can leave the button before
   any pointermove lands on it — which would strand the gesture. */
const DRAG_SLOP=6;                  // px of travel before a press is a drag
/* Which drag frame to show. The body trails the hand: a hand moving RIGHT
   leaves him swung to the left of the hood, moving LEFT swings him right. The
   speed picks how far (DRAG_STEPS, px/s), and held still he hangs straight
   (frame 6, the happy blink). Indices are into CLIPS.drag.f. */
const DRAG_STEPS=[70,170,340,620];    // px/s between: straight, a little, some, well, fully
const DRAG_LEFT=[6,3,1,2,0];          // straight → fully left (hand moving right)
const DRAG_RIGHT=[6,7,9,10];          // straight → well right (hand moving left); fully = 11-12 alternated
let dragSwingV=0;
function dragPoseNow(dt){
  dragSwingV+=(dragVX-dragSwingV)*Math.min(1,dt*12);     // eased, so the frame does not flicker
  const v=dragSwingV,a=Math.abs(v);
  const step=a<DRAG_STEPS[0]?0:a<DRAG_STEPS[1]?1:a<DRAG_STEPS[2]?2:a<DRAG_STEPS[3]?3:4;
  if(step===0)return 6;
  if(v>0)return DRAG_LEFT[step];
  return step<4?DRAG_RIGHT[step]:11+Math.floor(clock*6)%2;
}
let dragging=false,dragPointer=null,dragOffX=0,dragOffY=0,
    dragLastT=0,dragDownX=0,dragDownY=0,suppressClick=false;
/* The hand's velocity, kept as a vector so letting go can throw him. Below
   THROW_MIN px/s a release is a drop; above it the vector is carried into
   him, capped at THROW_MAX so a hard flick bounces rather than teleports. */
const THROW_MIN=220,THROW_MAX=1500;
let dragVX=0,dragVY=0;

pet.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  dragPointer=e.pointerId;dragDownX=e.clientX;dragDownY=e.clientY;
  dragOffX=state.x-e.clientX;dragOffY=state.y-e.clientY;dragLastT=e.timeStamp;
});

addEventListener('pointermove',e=>{
  if(e.pointerId!==dragPointer)return;
  if(!dragging){
    if(Math.hypot(e.clientX-dragDownX,e.clientY-dragDownY)<DRAG_SLOP)return;
    dragging=true;suppressClick=true;
    try{const n=(parseInt(sessionStorage.getItem('ace-pickups'),10)||0)+1;sessionStorage.setItem('ace-pickups',String(n));if(n%2===0){think('Please stop throwing me. …Okay, one more.');thinkHeld=true;}else if(thinkHeld)quiet();}catch(e){}   // every second pickup
    try{pet.setPointerCapture(dragPointer);}catch{}
    pet.classList.add('is-dragging');
    climb=null;runGoal=null;pendingJump=null;pointUntil=0;
    state.vx=0;state.vy=0;state.ground=null;state.bouncy=false;dragVX=dragVY=0;
    dragPose=6;dragSwingV=0;
    if(stuck){stuck=false;nextShiver=shiverUntil=0;floorLift=snowLift();}                  // pulled out of the snow: he will be set down on top of it
    if(slip){slip=null;slipRot=0;}                                                          // grabbed mid-slip: the slip is over
  }
  const nx=clampX(e.clientX+dragOffX),dx=nx-state.x;
  const ny=Math.max(-10,Math.min(innerHeight+40,e.clientY+dragOffY)),dy=ny-state.y;
  /* Smoothed against the clock, not against the sample count — pointermove
     fires at the device's rate, not the frame rate, so a raw per-event
     delta reads as a different speed on a 120Hz trackpad than on a 60Hz
     mouse. */
  const dtms=Math.max(6,e.timeStamp-dragLastT);dragLastT=e.timeStamp;
  dragVX=dragVX*.6+(dx/(dtms/1000))*.4;
  dragVY=dragVY*.6+(dy/(dtms/1000))*.4;
  if(Math.abs(dx)>1.5)facing=dx>0?1:-1;
  state.x=nx;state.y=ny;
  e.preventDefault();
},{passive:false});

function endDrag(e){
  if(e.pointerId!==dragPointer)return;
  dragPointer=null;
  if(!dragging)return;
  dragging=false;
  pet.classList.remove('is-dragging');
  try{pet.releasePointerCapture(e.pointerId);}catch{}
  /* A flick throws him and he bounces (physics.js, s.bouncy); a slow
     release just drops him. The velocity has already decayed in tick() if
     the hand stopped before letting go, so a still release is a drop. */
  const clampV=v=>Math.max(-THROW_MAX,Math.min(THROW_MAX,v));
  state.ground=null;
  if(Math.hypot(dragVX,dragVY)>THROW_MIN){state.vx=clampV(dragVX);state.vy=clampV(dragVY);state.bouncy=true;}
  else{state.vx=0;state.vy=0;state.bouncy=false;}
  dragVX=dragVY=0;
  runGoal=null;pendingJump=null;nextDecision=clock+.5;
}
addEventListener('pointerup',endDrag);
addEventListener('pointercancel',endDrag);
/* The click that fires at the end of a drag would otherwise open the chat. */
pet.addEventListener('click',e=>{
  if(!suppressClick)return;
  suppressClick=false;e.preventDefault();e.stopImmediatePropagation();
},true);
const perchY=(p,r)=>p.edge==='bottom'?r.bottom:r.top;
/* The block of copy he last climbed, as a surface. Only ever present while
   he is standing on it: it is deliberately NOT in `perches`, so choose()
   can never pick it as a jump target — copy is reachable by climbing only. */
function textSurfaceNow(){
  if(!textSurface)return null;
  const r=textSurface.el.getBoundingClientRect();
  if(r.width<100||r.bottom<40||r.top>innerHeight-20)return null;
  return {id:'text',left:r.left,right:r.right,y:r.top,el:textSurface.el};
}
function scan(){surfaces=[];for(let i=0;i<perches.length;i++){const p=perches[i],r=p.el.getBoundingClientRect();const y=perchY(p,r);if(r.width>PERCH_MIN_WIDTH&&y>150&&y<innerHeight-60&&r.right>60&&r.left<innerWidth-60){surfaces.push({id:String(i),left:Math.max(20,r.left),right:Math.min(innerWidth-20,r.right),y,el:p.el});}}surfaces=bridge(surfaces);const t=state.ground==='text'&&textSurfaceNow();if(t)surfaces.push(t);const v=visitSurface();if(v)surfaces.push(v);const l=launcherSurface();if(l)surfaces.push(l);surfaces.push({id:'floor',left:0,right:innerWidth,y:floorY()});}
/* The Ask Little Ace button, as a ledge. Added after the perch filter on
   purpose: it sits in the bottom 60px that filter keeps him out of, and it
   is where he spawns. Gone while the chat is open and the button is hidden. */
function launcherSurface(){if(launcher.hidden)return null;const r=launcher.getBoundingClientRect();if(!r.width)return null;return {id:'launcher',left:r.left,right:r.right,y:r.top};}
/* Three pricing cards in a row are one shelf, not three ledges. Anything on
   the same line separated by no more than a gutter is merged into a single
   surface, so he simply runs the length of it — the alternative was hopping
   card to card, which is what read as jumping for the sake of it.

   Merging rather than special-casing the walk is deliberate: a 24px gutter
   is a 24px hole, and he falls ~41px crossing one at running speed, so
   "walk off the edge and hope" lands him under the cards, not on the next
   one. Bridging makes the ledge genuinely continuous, and every other part
   of the system — reach, physics, the edge test — needs no idea it happened.
   The merged run keeps the first constituent's id so perches[id] still
   resolves for the button test. */
function bridge(list){
  const by=[...list].sort((a,b)=>a.y-b.y||a.left-b.left),out=[];
  for(const p of by){
    const last=out[out.length-1];
    if(last&&Math.abs(last.y-p.y)<=SAME_LEVEL&&p.left-last.right<=STEP_GAP){
      last.right=Math.max(last.right,p.right);
    }else out.push({...p});
  }
  return out;
}
function currentSurface(){if(state.ground==='floor')return {id:'floor',left:0,right:innerWidth,y:floorY()};if(state.ground==='text')return textSurfaceNow();if(state.ground==='visit')return visitSurface();if(state.ground==='launcher')return launcherSurface();if(state.ground===null)return null;
 /* The scanned list first: if he is standing on a bridged run, the element's
    own rect is only the card he happens to be over, and using it would drop
    him into the first gutter he reached. */
 const merged=surfaces.find(q=>q.id===state.ground);if(merged)return merged;const p=perches[Number(state.ground)];if(!p)return null;const r=p.el.getBoundingClientRect();return {id:state.ground,left:r.left,right:r.right,y:perchY(p,r),el:p.el};}
/* The last few ledges he stood on, newest first. Short on purpose: long
   enough to break a two-ledge loop, short enough that he will happily
   come back to a good spot a few moves later. */
const recent=[];
const RECENT_MAX=6;
function remember(id){
  if(id===null||id===undefined)return;
  const at=recent.indexOf(id);if(at>-1)recent.splice(at,1);
  recent.unshift(id);if(recent.length>RECENT_MAX)recent.pop();
}
// Heaviest for the ledge he just left, fading to nothing by the sixth.
function recentBonus(id){const at=recent.indexOf(id);return at<0?0:(RECENT_MAX-at)*55;}

/* How far he will take on in one jump. Up is capped well below what the
   physics can manage — jump() always solves an arc that clears the target,
   so an unbounded cap just produces a two-second moon-jump across the
   whole viewport. 400 is the gap from a card's button up to the top of the
   card it sits in — the shortest cap that still lets him climb from the
   floor to the top of the trio, one readable hop at a time. Dropping is
   cheaper to watch, so it is looser. */
const REACH_UP=400, REACH_DOWN=520;
/* Two ledges at the same height that touch or overlap are one walkable run
   as far as he is concerned. He leaves the ground only when the target is
   genuinely up, down, or across a gap — jumping between the two buttons in
   a row that sit on the same baseline read as a twitch, not a decision. */
const SAME_LEVEL=10;   // px of height difference that still counts as level
const STEP_GAP=34;     // px of gutter that is bridged into one walkable ledge
/* px of an elevated ledge he must be within before leaving it becomes a
   live option at all. The floor is exempt — it always has room in both
   directions, and applying this there would mean he almost never climbs
   onto anything in the first place. */
const POINT_HOLD=2.2;    // seconds he holds the point at a button
/* Bounded on BOTH sides, not just `clock<pointUntil`. A one-sided test
   says "hold until the clock passes this", which trusts the number to be
   reachable — and anything that puts it further off than the gesture is
   long (a clock rewind, a stale value) holds him there for good, with the
   decision loop gated off behind the same test. Asking instead whether the
   remaining hold is a SENSIBLE length means a nonsense value simply reads
   as "not pointing" and he carries on. */
function holdingPoint(){const left=pointUntil-clock;return left>0&&left<=POINT_HOLD;}
/* The nearest button clearly overhead: its bottom edge above his head (he is
   about 120px tall) and no more than ~520px up, with him under some part of
   it, give or take 80px. */
function buttonAbove(){
  let best=null,bd=1e9;
  for(const q of perches){
    if(!q.button)continue;
    const r=q.el.getBoundingClientRect();
    if(!r.width||r.bottom>state.y-110||r.bottom<state.y-520)continue;
    if(state.x<r.left-80||state.x>r.right+80)continue;
    const d=state.y-r.bottom;if(d<bd){bd=d;best=q;}
  }
  return best;
}

const SURFACE_EDGE=60;
/* Edges: he never stands, lands or stops within EDGE_KEEP px of a ledge's end, where the 'still on it' test and
   the landing test disagree and he flickers between falling and landing. inward() gives a safe spot. */
const EDGE_KEEP=30;
const inward=(g,x)=>g.right-g.left<EDGE_KEEP*2?(g.left+g.right)/2:Math.max(g.left+EDGE_KEEP,Math.min(g.right-EDGE_KEEP,x));
/* How often a decision made ON THE FLOOR is just "walk somewhere else
   along it" rather than a hunt for something to jump onto. The floor is
   exempt from the ledge rule below — it always has room, so applying that
   there would mean he never climbed anything — but the exemption also sent
   every floor decision straight to the jump hunt, which is where most of
   the remaining hopping came from. */
const FLOOR_ROAM=.55;
/* Why he kept ending up at the Ask Little Ace button (all three were him doing what the code told him):
   1. Every walk along the floor was clamped to the window, so a goal past the right edge became exactly the
      right edge: the clamp piles every overshoot onto the two edges, and the button sits on the right one.
   2. The button is also a ledge right beside the floor, and in the scoring it is almost always the NEAREST
      ledge to a floor-walker on the right, so he hopped floor to button to floor.
   3. On the button itself the "wide ledge, so run it end to end" rule fired every time he stood mid-button.
   Now floor walks keep out from under the button (a goal that lands there is spread out to its left instead of
   piling up), the button costs LAUNCHER_PENALTY in the scoring, and the end-to-end run on it is rare. */
const LAUNCHER_PENALTY=240;
function roamX(x){
  x=clampX(x);
  const l=launcherSurface();
  if(!l)return x;
  const lo=l.left-45,hi=l.right+45;
  if(x>lo&&x<hi)x=(state.x<(l.left+l.right)/2||hi>innerWidth-EDGE)?lo-Math.random()*180:hi;
  return clampX(x);
}
function inReach(up,down){
  return surfaces.filter(p=>p.id!==state.ground&&state.y-p.y<up&&p.y-state.y<down&&p.right-p.left>75);
}
const CLIMB_SPEED=78;             // px/s up the face of a block of copy

/* A block of copy he could climb: on screen, above his feet but not so far
   above that the ascent outlasts anyone's patience, and wide enough that
   its left edge is somewhere he can stand at the top. */
function climbTarget(){
  const best=[];
  for(const c of climbables){
    if(clock<(c.rest||0))continue;                        // climbed (or fell off) lately: not straight back up it
    const r=c.el.getBoundingClientRect();
    if(r.top<90||r.bottom>innerHeight-40)continue;
    const rise=state.y-r.top;
    if(rise<70||rise>460)continue;
    const x=clampX(r.left+16);
    best.push({el:c.el,x,topY:r.top,cost:Math.abs(x-state.x)+rise*.4+Math.abs(x-cursorX)*.3+Math.random()*90});
  }
  if(!best.length)return null;
  best.sort((a,b)=>a.cost-b.cost);
  return best[0];
}

/* busy: the visitor is moving (see PACE). Busy, he hops and climbs more and
   walks less; calm, he prefers the ground he is on. Either way the places
   he picks are pulled toward the pointer — where the visitor is looking —
   and toward buttons, which he can point at. */
function choose(busy){
 const ground=currentSurface();
 /* More climby: a block of copy is tried first on a share of decisions,
    not only when nothing else is in reach. */
 if(Math.random()<(busy?.45:.3)){
   const t=climbTarget();
   if(t){climb=t;runGoal=t.x;nextDecision=clock+8;return;}
 }
 /* Comfortably in the middle of a wide ledge: this is what "flat surface,
    so he runs" means, and it is the actual bug behind the jumping-bean
    complaint. inReach() below deliberately excludes the surface he is
    already standing on, so every choice it offers is a jump to somewhere
    else — even with 800px of the ledge he is on left to walk. That has to
    be decided here, before inReach() is ever consulted, or it never gets
    a turn. */
 if(ground&&ground.id!=='floor'&&ground.right-ground.left>140&&
    state.x-ground.left>SURFACE_EDGE&&ground.right-state.x>SURFACE_EDGE&&
    !(busy&&Math.random()<.4)&&!(ground.id==='launcher'&&Math.random()<.7)){
   const x=Math.random()<.5?ground.right-35:ground.left+35;
   runGoal=clampX(x);nextDecision=clock+.5;return;
 }
 /* On the floor: often enough, just walk it. He still explores the page,
    he simply does more of it on foot. */
 if(ground&&ground.id==='floor'&&Math.random()<(busy?.3:FLOOR_ROAM)){
   runGoal=roamX(state.x+(Math.random()<.5?-1:1)*(140+Math.random()*220));
   nextDecision=clock+.6;return;
 }
 /* Normal reach first, so he prefers a short readable hop. If nothing is
    within it he tries again for anything on screen at all — on a page
    that is mostly body copy the only ledges may be a button and a rule
    near the top, and capping his reach there left him pacing the floor
    for as long as you cared to watch. An occasional big leap is better
    than a companion that never leaves the bottom of the window. */
 let choices=inReach(REACH_UP,REACH_DOWN);
 /* Nothing within a normal hop — which on a prose page is most of the time.
    Rather than pace, go up the words: walk to the left edge of a nearby
    block of copy and climb it. This is tried BEFORE the long jump below,
    both because it is the nicer thing to watch and because it keeps him on
    the page: the long jump used to fire here and fling him off the top of
    the viewport. */
 if(!choices.length){
   const t=climbTarget();
   if(t){climb=t;runGoal=t.x;nextDecision=clock+8;return;}
 }
 /* Still nothing, so reach further — but measured from the top of the
    window rather than from him, so the cap tightens as he climbs. jump()
    clears its target by ~95px, so anything higher than 140px from the top
    puts the peak of the arc off-screen and he drops back in like a stone.
    (Taking max() with REACH_UP here was the bug: once he was already high,
    it handed the reach back and flung him out of the viewport.) */
 if(!choices.length)choices=inReach(state.y-140,REACH_DOWN*1.4);
 if(!choices.length){
   /* Not even that, so wander. The destination is clamped into the
      walkable strip: an unclamped one sits outside the range state.x can
      reach, |dx| never falls under the arrival threshold, and he jogs on
      the spot against the edge of the window until the page is reloaded.
      On a non-floor ledge it is clamped to that ledge's own bounds too —
      otherwise this is the fallback that runs him off a perch he has
      legitimately used up, into a fall that reads as an accident rather
      than a choice. */
   let tx=state.x+(Math.random()<.5?-1:1)*(90+Math.random()*90);
   if(ground&&ground.id!=='floor')tx=Math.max(ground.left+35,Math.min(ground.right-35,tx));
   runGoal=ground&&ground.id==='floor'?roamX(tx):clampX(tx);nextDecision=clock+.6;return;
 }
 /* Nearest wins, minus wherever he has just been. Distance alone made
    him bounce between the same neighbouring pair indefinitely — the ledge
    he just left is always the closest one. The recency penalty pushes him
    off that pair and onto the next thing along, which is what reads as
    exploring the page rather than pacing. The floor is penalised too, so
    he prefers to climb. */
 const scored=choices.map(p=>({p,score:
   Math.abs((p.left+p.right)/2-state.x)+Math.abs(p.y-state.y)*.5
   +Math.random()*55
   +(p.id==='floor'?140:0)
   +(p.id==='launcher'?LAUNCHER_PENALTY:0)
   +recentBonus(p.id)
   +Math.abs((p.left+p.right)/2-cursorX)*(busy?.35:.6)
   -(perches[Number(p.id)]&&perches[Number(p.id)].button?90:0)})).sort((a,b)=>a.score-b.score);
 const p=scored[Math.min(scored.length-1,Math.random()<.25?1:0)].p;
 /* Spread landings across the ledge instead of always touching down where
    he took off, so a wide tray gets walked rather than stood on. */
 let x=inward(p,Math.max(p.left+35,Math.min(p.right-35,state.x+(Math.random()-.5)*260)));
 if(p.id==='floor')x=roamX(x);
 target={id:p.id,x,y:p.y};
 const distance=Math.abs(x-state.x);
 /* Too far to jump: walk to the near end of the current surface first.
    Clamped for the same reason — on the floor, ground.left is 0, so the
    unclamped run-up target was 35px off the left of the screen. */
 if(distance>230&&ground){runGoal=ground.id==='floor'?roamX(Math.max(ground.left+45,Math.min(ground.right-45,x))):clampX(x>state.x?ground.right+35:ground.left-35);nextDecision=clock+.45;return;}
 pendingJump=target;crouchUntil=clock+.16;runGoal=null;
}
/* dt is clamped at BOTH ends. The cap is the usual "do not let a long
   stall teleport him"; the floor at zero matters more than it looks. Every
   timer he has — pointUntil, nextDecision, landingUntil, crouchUntil,
   nextChatPose — is a comparison against `clock`, so a single negative dt
   rewinds the clock and strands every one of them in the future at once.
   That leaves him frozen mid-gesture with no decisions, alive but stuck,
   which is exactly the state he was found in. */
/* ── POWER-UP ─────────────────────────────────────────────────
   Once in a blue moon: he powers up in gold (hair gold, eyes blue), turns
   side-on, charges and fires a blue beam across the page, then is back to
   normal. Twenty-four frames from their own sheet (assets/images/ace-power.webp,
   6x4 cells of 264x300, loaded only the first time it plays), drawn on a
   canvas that sits over him while his normal sprite is hidden. The beam is
   not in the artwork: it is drawn here so it can reach whatever edge of the
   page is in front of him, whatever the width.
   Triggers: Shift + A + C + E (held together or typed in order), or on the shared timer (one big moment per POWER_EVERY seconds of roaming), or on its
   own every POWER_EVERY seconds of visible time, but only when he is
   standing about with nothing else going on. Never while the chat is open,
   the gate is up, he is being carried, or the visitor prefers reduced motion. */
const POWER_SHEET=window.ACE_XMAS?'assets/images/ace-power-xmas.webp?v=1':'assets/images/ace-power.webp?v=1',POWER_EVERY=150,POWER_SLOW=1.25;   // POWER_EVERY: after this much normal roaming, one big moment (power-up, or the sleigh at Christmas)
const POWER_CW=264,POWER_CH=300,POWER_COLS=6;
const POWER_MS=[150,120,100,120,100,90,90,90,90,90,80,100,100,100,60,60,60,60,60,60,70,80,100,150];
const POWER_HANDS=window.ACE_XMAS?{"15": [182, 183], "16": [188, 178], "17": [186, 177], "18": [181, 178], "19": [188, 175], "20": [187, 175], "21": [178, 194]}:{"15": [176, 181], "16": [186, 178], "17": [185, 178], "18": [180, 179], "19": [188, 176], "20": [187, 176], "21": [177, 109]};     // fingertips per beam frame (frame number -> x,y in the cell), side facing right
const POWER_TOTAL=POWER_MS.reduce((a,b)=>a+b,0)*POWER_SLOW/1000;
const pwCv=document.createElement('canvas');pwCv.width=POWER_CW;pwCv.height=POWER_CH;pwCv.className='ace-power';pwCv.setAttribute('aria-hidden','true');
const beamCv=document.createElement('canvas');beamCv.className='ace-beam';beamCv.setAttribute('aria-hidden','true');
const pwZ=getComputedStyle(pet).zIndex;
pwCv.style.cssText='position:fixed;left:0;top:0;width:'+POWER_CW/2+'px;height:'+POWER_CH/2+'px;pointer-events:none;display:none;will-change:transform;z-index:'+(pwZ==='auto'?'60':pwZ);
beamCv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;display:none;z-index:'+(pwZ==='auto'?'60':pwZ);
document.body.append(beamCv,pwCv);
const pwCtx=pwCv.getContext('2d'),bmCtx=beamCv.getContext('2d');
let power=null,pwImg=null,pwReady=false,pwClock=0,pwLast=0,nextAuto=POWER_EVERY,powerQueue=false,powerQueueKind='power',powerQueueUntil=0,beamDpr=1,lastBig='';
/* Everything a big moment needs except the snow: the automatic timer also needs him out of it (powerOk). */
function powerReady(){
  const h=document.documentElement;
  return ready&&!open&&!dragging&&!parked&&!motionPaused&&!calm.matches&&state.ground!==null&&!climb&&!pendingJump&&!visit
    &&!h.classList.contains('gate-locked')&&!h.classList.contains('intro')&&clock>=waveUntil&&!holdingPoint();
}
function powerOk(){return powerReady()&&!stuck&&floorLift===0;}
function sizeBeam(){beamDpr=Math.min(2,window.devicePixelRatio||1);beamCv.style.width=innerWidth+'px';beamCv.style.height=innerHeight+'px';beamCv.width=Math.round(innerWidth*beamDpr);beamCv.height=Math.round(innerHeight*beamDpr);}
function beginPower(){
  if(!pwImg){pwImg=new Image();pwImg.onload=()=>{pwReady=true;};pwImg.src=POWER_SHEET;}
  if(!pwReady){powerQueue=true;powerQueueKind='power';powerQueueUntil=pwClock+10;return;}
  power={t:0,dir:state.x>innerWidth/2?-1:1};
  waveUntil=clock+POWER_TOTAL+.3;nextDecision=Math.max(nextDecision,clock+POWER_TOTAL+1.2);runGoal=null;
  pet.style.visibility='hidden';pwCv.style.display='block';beamCv.style.display='block';sizeBeam();
}
function endPower(){
  power=null;pwCv.style.display='none';beamCv.style.display='none';bmCtx.clearRect(0,0,beamCv.width,beamCv.height);
  pet.style.visibility='';nextAuto=pwClock+POWER_EVERY;waveUntil=Math.min(waveUntil,clock+.1);
}
/* Beam strength by (fractional) frame position p: length and thickness as a share of the maximum. */
const BEAM_KEYS=[[14,0,0],[15,.30,.55],[16,.70,.85],[17,1,1],[18,1,.92],[19,1,.85],[20,1,.30],[20.6,1,0]];
function beamAt(p){
  if(p<BEAM_KEYS[0][0]||p>=BEAM_KEYS[BEAM_KEYS.length-1][0])return null;
  for(let i=1;i<BEAM_KEYS.length;i++){
    const a=BEAM_KEYS[i-1],b=BEAM_KEYS[i];
    if(p<=b[0]){const u=(p-a[0])/(b[0]-a[0]);return{l:a[1]+(b[1]-a[1])*u,w:a[2]+(b[2]-a[2])*u};}
  }
  return null;
}
function drawBeam(p,dir,ox,oy,t){
  const c=bmCtx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,beamCv.width,beamCv.height);c.setTransform(beamDpr,0,0,beamDpr,0,0);
  if(p<14||p>=21)return;
  c.globalCompositeOperation='lighter';
  const flash=Math.max(0,1-(p-14)/3);
  // shock ring at the hands as it fires
  if(p<17){const rr=(p-14)*38,a=Math.max(0,1-(p-14)/3)*.7;c.strokeStyle='rgba(170,225,255,'+a+')';c.lineWidth=3;c.beginPath();c.ellipse(ox,oy,rr*.8,rr*1.2,0,0,Math.PI*2);c.stroke();}
  const k=beamAt(p);
  const maxLen=(dir>0?innerWidth-ox:ox)+80;
  if(k&&k.w>0){
    const W=54*k.w,len=maxLen*k.l,step=8,top=[],bot=[];
    for(let s=0;s<=len;s+=step){
      const h=(W/2)*(0.5+0.5*Math.min(1,s/70))*(1+0.07*Math.sin(s*0.09-t*38)+0.03*Math.sin(s*0.23+t*61));
      const x=ox+dir*s;top.push([x,oy-h]);bot.push([x,oy+h]);
    }
    const pass=(scale,col,blur)=>{
      c.save();c.shadowColor='rgba(63,182,255,.9)';c.shadowBlur=blur;c.fillStyle=col;
      c.beginPath();c.moveTo(top[0][0],oy+(top[0][1]-oy)*scale);
      for(const q of top)c.lineTo(q[0],oy+(q[1]-oy)*scale);
      for(let i=bot.length-1;i>=0;i--)c.lineTo(bot[i][0],oy+(bot[i][1]-oy)*scale);
      c.closePath();c.fill();c.restore();
    };
    const g=c.createLinearGradient(ox,0,ox+dir*Math.max(len,1),0);
    g.addColorStop(0,'rgba(120,205,255,1)');g.addColorStop(.7,'rgba(63,182,255,.95)');g.addColorStop(1,'rgba(63,182,255,.55)');
    pass(1.9,'rgba(63,182,255,.22)',34);
    pass(1.0,g,16);
    pass(.46,'rgba(255,255,255,.96)',8);
  }
  // bright flare where it leaves his hands
  const fr=22+54*(k?k.w:0)*.6+flash*26,rg=c.createRadialGradient(ox,oy,0,ox,oy,fr);
  rg.addColorStop(0,'rgba(255,255,255,'+(0.55+0.4*flash)+')');rg.addColorStop(.35,'rgba(130,210,255,.55)');rg.addColorStop(1,'rgba(63,182,255,0)');
  c.fillStyle=rg;c.beginPath();c.arc(ox,oy,fr,0,Math.PI*2);c.fill();
  c.globalCompositeOperation='source-over';
}
/* The beam blows the snow up. Along its length, at the drift, a steady spray of dust is blown the way it points; and behind
   him (the side he is not firing to) a big plume rolls out, with a burst the moment it fires. The nearer the beam is to the
   drift the more there is (from a ledge high up there is little). */
function beamSnow(p,dir,ox,oy,dt){
  if(!window.ACE_XMAS||!window.AceSnow||!AceSnow.kick)return;
  const near=Math.max(0,Math.min(1,1-((innerHeight-AceSnow.top())-oy)/320));
  if(near<=0)return;
  if(!power.burst&&p>=15){power.burst=true;AceSnow.kick(state.x-dir*70,80,{dir:-dir,push:440,v:2,spread:2.9,w:170,clouds:11,drag:1.6});}
  const k=beamAt(p);if(!k||k.w<=0)return;
  const len=((dir>0?innerWidth-ox:ox)+80)*k.l;
  for(let i=Math.ceil(dt*230*near*k.w);i>0;i--)AceSnow.kick(ox+dir*Math.random()*len,3,{dir,push:300,v:1.1,spread:1.9,w:60,clouds:Math.random()<.18?1:0,drag:1.3});
  for(let i=Math.ceil(dt*270*near*k.w);i>0;i--)AceSnow.kick(state.x-dir*(20+Math.random()*170),3,{dir:-dir,push:340,v:1.5,spread:2.5,w:60,clouds:Math.random()<.2?1:0,drag:1.5});
}
function stepPower(dt){
  const h=document.documentElement;
  if(open||dragging||h.classList.contains('gate-locked')){endPower();return;}
  power.t+=dt;
  let acc=0,idx=POWER_MS.length-1,frac=1;
  for(let i=0;i<POWER_MS.length;i++){
    const d=POWER_MS[i]*POWER_SLOW/1000;
    if(power.t<acc+d){idx=i;frac=(power.t-acc)/d;break;}
    acc+=d;
  }
  if(power.t>=POWER_TOTAL){endPower();return;}
  pwCv.style.transform='translate3d('+(state.x-POWER_CW/4).toFixed(1)+'px,'+(state.y-FEET_Y/2).toFixed(1)+'px,0)';
  const flip=power.dir<0&&idx>=10&&idx<=20;      // frames 11-21 are the side-on ones, drawn facing right
  pwCtx.clearRect(0,0,POWER_CW,POWER_CH);
  const sx=(idx%POWER_COLS)*POWER_CW,sy=Math.floor(idx/POWER_COLS)*POWER_CH;
  if(flip){pwCtx.save();pwCtx.translate(POWER_CW,0);pwCtx.scale(-1,1);pwCtx.drawImage(pwImg,sx,sy,POWER_CW,POWER_CH,0,0,POWER_CW,POWER_CH);pwCtx.restore();}
  else pwCtx.drawImage(pwImg,sx,sy,POWER_CW,POWER_CH,0,0,POWER_CW,POWER_CH);
  // the beam starts at frame 15 (index 14) from his fingertips
  const hf=Math.min(Math.max(idx+1,15),20),hd=POWER_HANDS[String(hf)];
  if(hd){
    const hx=(flip?POWER_CW-hd[0]:hd[0])-10*(flip?-1:1),hy=hd[1];
    const ox=state.x-POWER_CW/4+hx/2,oy=state.y-FEET_Y/2+hy/2;
    drawBeam(idx+frac,power.dir,ox,oy,power.t);
    beamSnow(idx+frac,power.dir,ox,oy,dt);
  }
}
/* ── SUMMON ─────────────────────────────────────────────────
   Normal mode only (the art has his cap, not the Santa hat). He calls a shield and a hammer in from off the page, catches
   them, holds the hammer up while lightning crackles around him, throws them off opposite sides of the page and goes back
   to being chill. His frames are the top four rows of assets/images/ace-summon.webp (5 x 4 cells of 280x300, feet at 140,292);
   the fifth row holds the shield and the hammer on their own, for the flights. Lightning and flights are drawn on the beam canvas.
   SU_STEPS is [cell, milliseconds]. Shares the big-moment timer; Shift + T, H, O, R plays it. */
const SUMMON_SHEET='assets/images/ace-summon.webp?v=1',SU_CW=280,SU_CH=300,SU_COLS=5,SU_FX=140,SU_FY=292;
const SU_STEPS=[[0,120],[1,110],[2,110],[3,150],[4,250],[5,180],[6,200],[7,130],[8,100],[9,80],[10,110],[11,110],[10,110],[11,110],[10,110],[11,110],[12,270],[13,90],[14,100],[15,440],[16,170],[17,100],[18,110],[1,110],[19,850]];
const SU_AT=[];{let t=0;for(const st of SU_STEPS){SU_AT.push(t);t+=st[1]/1000;}SU_AT.push(t);}
const SU_TOTAL=SU_AT[SU_AT.length-1],SU_THROW=SU_AT[20],SU_THROW_SPEED=1700;
const SU_SHIELD=[170,197],SU_HAMMER=[85,196],SU_SHIELD_OUT=[162,193],SU_HAMMER_OUT=[104,176],SU_BOLT=[91,100];   // in cell px
const suCv=document.createElement('canvas');suCv.width=SU_CW;suCv.height=SU_CH;suCv.setAttribute('aria-hidden','true');
suCv.style.cssText='position:fixed;left:0;top:0;width:'+SU_CW/2+'px;height:'+SU_CH/2+'px;pointer-events:none;display:none;will-change:transform;z-index:'+(pwZ==='auto'?'60':pwZ);
document.body.append(suCv);
const suCtx=suCv.getContext('2d');
let summon=null,suImg=null,suReady=false;
function beginSummon(){
  if(!suImg){suImg=new Image();suImg.onload=()=>{suReady=true;};suImg.src=SUMMON_SHEET;}
  if(!suReady){powerQueue=true;powerQueueKind='summon';powerQueueUntil=pwClock+10;return;}
  summon={t:0,bolts:[],nextBolt:0};
  waveUntil=clock+SU_TOTAL+.3;nextDecision=Math.max(nextDecision,clock+SU_TOTAL+1.2);runGoal=null;
  pet.style.visibility='hidden';suCv.style.display='block';beamCv.style.display='block';sizeBeam();
}
function endSummon(){
  summon=null;suCv.style.display='none';beamCv.style.display='none';bmCtx.setTransform(1,0,0,1,0,0);bmCtx.clearRect(0,0,beamCv.width,beamCv.height);
  pet.style.visibility='';nextAuto=pwClock+POWER_EVERY;waveUntil=Math.min(waveUntil,clock+.1);
}
function suObject(c,which,x,y,rot,h){
  const w=h*(which?123/200:195/200),sx=which*SU_CW+(SU_CW-(which?123:195))/2,sy=4*SU_CH+50;
  c.save();c.translate(x,y);c.rotate(rot);c.drawImage(suImg,sx,sy,which?123:195,200,-w/2,-h/2,w,h);c.restore();
}
function suJag(x0,y0,x1,y1){
  const pts=[[x0,y0]],n=7+Math.floor(Math.random()*4),len=Math.hypot(x1-x0,y1-y0),nx=-(y1-y0)/(len||1),ny=(x1-x0)/(len||1);
  for(let i=1;i<n;i++){const u=i/n,off=(Math.random()-.5)*len*.22;pts.push([x0+(x1-x0)*u+nx*off,y0+(y1-y0)*u+ny*off]);}
  pts.push([x1,y1]);return pts;
}
function stepSummon(dt){
  const h=document.documentElement;
  if(open||dragging||h.classList.contains('gate-locked')){endSummon();return;}
  const s=summon;s.t+=dt;
  if(s.t>=SU_TOTAL){endSummon();return;}
  let idx=SU_STEPS.length-1;for(let i=0;i<SU_STEPS.length;i++)if(s.t<SU_AT[i+1]){idx=i;break;}
  const cell=SU_STEPS[idx][0],ox=state.x-SU_FX/2,oy=state.y-SU_FY/2,px=p=>[ox+p[0]/2,oy+p[1]/2];
  suCv.style.transform='translate3d('+ox.toFixed(1)+'px,'+oy.toFixed(1)+'px,0)';
  suCtx.clearRect(0,0,SU_CW,SU_CH);
  suCtx.drawImage(suImg,(cell%SU_COLS)*SU_CW,Math.floor(cell/SU_COLS)*SU_CH,SU_CW,SU_CH,0,0,SU_CW,SU_CH);
  const c=bmCtx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,beamCv.width,beamCv.height);c.setTransform(beamDpr,0,0,beamDpr,0,0);
  const flyIn=(from,to,a,b,which,sz,spins)=>{
    if(s.t<a||s.t>=b)return;
    const u=(s.t-a)/(b-a),e=u*u*(3-2*u);
    suObject(c,which,from[0]+(to[0]-from[0])*e,from[1]+(to[1]-from[1])*e,(1-e)*spins*6.283,sz);
  };
  flyIn([innerWidth+60,oy-40],px(SU_SHIELD),SU_AT[3],SU_AT[5],0,34,3);
  flyIn([-60,oy-40],px(SU_HAMMER),SU_AT[5],SU_AT[7],1,40,3);
  if(s.t>=SU_THROW){
    const d=s.t-SU_THROW,a=px(SU_SHIELD_OUT),b=px(SU_HAMMER_OUT);
    suObject(c,0,a[0]+SU_THROW_SPEED*d,a[1]-90*d,d*22,34);
    suObject(c,1,b[0]-SU_THROW_SPEED*d,b[1]-90*d,-d*22,40);
  }
  if(idx>=10&&idx<=15){                                          // lightning: fresh bolts every few hundredths of a second
    const hp=px(SU_BOLT),cx=state.x,cy=state.y-60;
    if(s.t>=s.nextBolt){
      s.nextBolt=s.t+.065;s.bolts=[suJag(hp[0],hp[1],hp[0]+(Math.random()-.5)*90,-20)];
      for(let i=0;i<5;i++){const a=Math.random()*6.283,r=55+Math.random()*85;s.bolts.push(suJag(i%2?hp[0]:cx,i%2?hp[1]:cy,cx+Math.cos(a)*r,cy+Math.sin(a)*r*.9));}
    }
    c.globalCompositeOperation='lighter';c.lineJoin='round';c.lineCap='round';
    const line=(p,col,w,blur)=>{c.strokeStyle=col;c.lineWidth=w;c.shadowColor='rgba(110,180,255,.95)';c.shadowBlur=blur;c.beginPath();p.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.stroke();};
    for(const b of s.bolts){line(b,'rgba(95,165,255,.55)',4,14);line(b,'rgba(240,248,255,.95)',1.4,5);}
    c.shadowBlur=0;
    const g=c.createRadialGradient(hp[0],hp[1],0,hp[0],hp[1],46);g.addColorStop(0,'rgba(225,240,255,.8)');g.addColorStop(1,'rgba(90,160,255,0)');
    c.fillStyle=g;c.beginPath();c.arc(hp[0],hp[1],46,0,6.283);c.fill();
    c.globalCompositeOperation='source-over';
  }
}
/* ── SANTA'S SLEIGH ───────────────────────────────────────────
   The second of the big moments (see POWER-UP above; they share one scheduler). He runs off the
   page on the left, a few moments later flies across the top of the page in a sleigh pulled by two
   mechanical reindeer, waving, in an arc that ends off the right edge, and a few moments after
   that runs back in from the right edge. Twelve frames from their own sheet
   (assets/images/ace-sleigh.webp, 3x4 cells of 562x250, loaded the first time it plays).
   While it runs he is moved from here, not by the roaming code: tick() just draws whatever clip
   and facing this asks for. Triggers: Shift + S, A, N, T, A typed in order, or the shared timer
   (Christmas only). Same guards as the power-up; if the chat opens or he is picked up it ends at once. */
const SLEIGH_SHEET='assets/images/ace-sleigh.webp?v=2',SL_CW=562,SL_CH=250,SL_FPS=15,SL_FRAMES=12,SL_COLS=3,SL_RUN=1.15;
const slCv=document.createElement('canvas');slCv.width=SL_CW;slCv.height=SL_CH;slCv.setAttribute('aria-hidden','true');
slCv.style.cssText='position:fixed;left:0;top:0;pointer-events:none;display:none;will-change:transform;z-index:120';
document.body.append(slCv);
const slCtx=slCv.getContext('2d');
let sleigh=null,slImg=null,slReady=false;
function beginSleigh(){
  if(!slImg){slImg=new Image();slImg.onload=()=>{slReady=true;};slImg.src=SLEIGH_SHEET;}
  if(!slReady){powerQueue=true;powerQueueKind='sleigh';powerQueueUntil=pwClock+10;return;}
  sleigh={phase:'out',t:0,wait:0,hidden:false,clip:'run',facing:-1,y0:state.y,drop:state.ground==='floor'?0:1,goal:0,fi:-1,sparks:[],tint:0};
  state.ground='floor';state.vx=state.vy=0;runGoal=null;pendingJump=null;climb=null;
  nextDecision=clock+99;waveUntil=0;
}
function endSleigh(abort){
  sleigh=null;slCv.style.display='none';beamCv.style.display='none';beamCv.style.zIndex=pwZ==='auto'?'60':pwZ;
  bmCtx.setTransform(1,0,0,1,0,0);bmCtx.clearRect(0,0,beamCv.width,beamCv.height);
  pet.style.visibility='';
  state.ground='floor';state.vx=state.vy=0;state.y=innerHeight-16;state.x=clampX(state.x);
  runGoal=null;pendingJump=null;nextDecision=clock+1.2;
  if(!abort)waveUntil=clock+1.3;
  nextAuto=pwClock+POWER_EVERY;
}
function stepSleigh(dt){
  const h=document.documentElement;
  if(open||dragging||h.classList.contains('gate-locked')){endSleigh(true);return;}
  const s=sleigh,fl=innerHeight-16;s.t+=dt;
  if(s.phase==='out'){
    s.facing=-1;
    if(s.drop&&s.t<.5){state.y=s.y0+(fl-s.y0)*(s.t/.5);s.clip='fall';}
    else{state.y=fl;s.clip='run';state.x-=RUN_SPEED*SL_RUN*dt;}
    if(state.x<-SPRITE_W/2-10){s.phase='gap1';s.t=0;s.hidden=true;pet.style.visibility='hidden';s.wait=1.4+Math.random()*.9;}
  }else if(s.phase==='gap1'){
    if(s.t>=s.wait){s.phase='fly';s.t=0;slCv.style.display='block';sizeBeam();beamCv.style.zIndex='119';beamCv.style.display='block';}
  }else if(s.phase==='fly'){
    const W=Math.max(300,Math.min(575,innerWidth*.475)),Hh=W*SL_CH/SL_CW;
    const dur=(innerWidth+2*W)/(innerWidth<700?320:400),u=Math.min(1,s.t/dur);
    const top=Math.max(10,innerHeight*.06),base=Math.min(innerHeight*.36,top+innerHeight*.30);
    const X=u=>-W+(innerWidth+2*W)*u,Y=u=>base-(base-top)*(1-Math.pow(2*u-1,2));
    const x=X(u),y=Y(u),ang=Math.atan2(Y(Math.min(1,u+.02))-Y(Math.max(0,u-.02)),X(Math.min(1,u+.02))-X(Math.max(0,u-.02)))*.7;
    slCv.style.width=W+'px';slCv.style.height=Hh+'px';slCv.style.transformOrigin='50% 60%';
    slCv.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) rotate('+ang.toFixed(3)+'rad)';
    const fi=Math.floor(s.t*SL_FPS)%SL_FRAMES;
    if(fi!==s.fi){s.fi=fi;slCtx.clearRect(0,0,SL_CW,SL_CH);slCtx.drawImage(slImg,(fi%SL_COLS)*SL_CW,Math.floor(fi/SL_COLS)*SL_CH,SL_CW,SL_CH,0,0,SL_CW,SL_CH);}
    // a trail of gold sparkles drifting off the runners and hooves
    const c=bmCtx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,beamCv.width,beamCv.height);c.setTransform(beamDpr,0,0,beamDpr,0,0);
    if(u<1)for(let i=0;i<3;i++)s.sparks.push({x:x+W*(.05+Math.random()*.85),y:y+Hh*(.5+Math.random()*.45),vx:-(25+Math.random()*60),vy:8+Math.random()*40,l:0,m:.6+Math.random()*.7,r:1.4+Math.random()*2.4,w:Math.random()<.35});
    c.globalCompositeOperation='lighter';
    for(let i=s.sparks.length-1;i>=0;i--){
      const p=s.sparks[i];p.l+=dt;if(p.l>=p.m){s.sparks.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=60*dt;
      const k=1-p.l/p.m,g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);
      g.addColorStop(0,p.w?'rgba(255,255,255,'+k+')':'rgba(255,214,120,'+k+')');g.addColorStop(1,'rgba(255,190,70,0)');
      c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,p.r*3,0,Math.PI*2);c.fill();
    }
    c.globalCompositeOperation='source-over';
    if(u>=1&&!s.sparks.length){s.phase='gap2';s.t=0;slCv.style.display='none';beamCv.style.display='none';s.wait=1.2+Math.random()*.9;}
  }else if(s.phase==='gap2'){
    if(s.t>=s.wait){
      s.phase='in';s.t=0;state.x=innerWidth+SPRITE_W/2+10;state.y=fl;s.facing=-1;s.clip='run';
      s.goal=Math.max(EDGE+60,innerWidth-(160+Math.random()*260));
      pet.style.visibility='';s.hidden=false;
    }
  }else if(s.phase==='in'){
    s.facing=-1;s.clip='run';state.y=fl;state.x-=RUN_SPEED*SL_RUN*dt;
    if(state.x<=s.goal)endSleigh(false);
  }
}

/* ── SUPER SAIYAN FLOAT ───────────────────────────────────────
   The other half of the power-up: he powers up on the spot, floats up into the air, hovers there for a moment
   in his gold aura, then comes back down where he was and powers back down to normal. Shares the power-up's
   triggers: Shift + A + C + E and the hold on the button pick the beam or this (never the same twice running),
   and the big-moment timer chooses between them too. At Christmas the frames come from ace-flight-xmas.webp (Santa hat).
   Frames: assets/images/ace-flight.webp, 6x4 cells of 240x280 (the same size as the atlas), loaded the first time.
     0-4 power up on the ground, 6 rising, 14-17 hover loop, 18 coming down, 19-23 touch-down and power down
     (23 = his idle pose). The gold aura, flames, sparks and flashes are drawn here, on the beam canvas.
   While it runs his page sprite is hidden and the roaming code leaves him alone. Opening the chat, picking him up
   or the gate coming up ends it at once. */
const FLIGHT_SHEET=window.ACE_XMAS?'assets/images/ace-flight-xmas.webp?v=1':'assets/images/ace-flight.webp?v=1',FL_PIVOT=52.5;    // FL_PIVOT: his body centre, px above his feet
const FL_RISE=110,FL_RISE_T=1.1,FL_HOVER_T=3.2,FL_DOWN_T=1.0;            // how high (px), and how long each part takes (s)
const FL_UP=[[0,.30],[1,.22],[2,.40],[3,.55],[4,.28]];                  // power-up frames and how long each is held (s)
const FL_LAND=[[19,.16],[20,.26],[21,.34],[22,.32],[23,.30]];            // touch-down and power-down
const flCv=document.createElement('canvas');flCv.width=400;flCv.height=400;flCv.setAttribute('aria-hidden','true');
flCv.style.cssText='position:fixed;left:0;top:0;width:200px;height:200px;pointer-events:none;display:none;will-change:transform;z-index:'+(pwZ==='auto'?'60':pwZ);
document.body.append(flCv);
const flCtx=flCv.getContext('2d');
let flight=null,flImg=null,flReady=false;
function beginFlight(escape){
  if(!flImg){flImg=new Image();flImg.onload=()=>{flReady=true;};flImg.src=FLIGHT_SHEET;}
  if(!flReady){if(!escape){powerQueue=true;powerQueueKind='flight';powerQueueUntil=pwClock+10;}return false;}
  const top=Math.max(90,state.y-FL_PIVOT-FL_RISE);                     // not up into the header
  flight={phase:'up',t:0,fx:state.x,fy:state.y,g0:state.ground,px:state.x,py:state.y-FL_PIVOT,hy:top,vy:0,
          frame:0,aura:0,sparks:[],flashes:[],escape:!!escape};
  if(escape){stuck=false;nextShiver=shiverUntil=0;floorLift=snowLift();f0Land();try{sessionStorage.removeItem(STUCK_KEY);}catch(e){}}
  runGoal=null;pendingJump=null;climb=null;waveUntil=0;nextDecision=clock+99;state.vx=state.vy=0;
  pet.style.visibility='hidden';flCv.style.display='block';sizeBeam();beamCv.style.display='block';
}
function f0Land(){flight.ly=innerHeight-16-floorLift;}   // escape: where his feet come down, on top of the snow
function endFlight(abort){
  const f=flight;flight=null;
  flCv.style.display='none';beamCv.style.display='none';
  bmCtx.setTransform(1,0,0,1,0,0);bmCtx.clearRect(0,0,beamCv.width,beamCv.height);
  pet.style.visibility='';state.vx=state.vy=0;
  if(f){state.x=clampX(f.fx);state.y=f.fy;}
  if(f&&f.escape){state.ground='floor';state.y=floorY();runGoal=null;pendingJump=null;nextDecision=clock+1.2;nextAuto=pwClock+POWER_EVERY;return;}
  // back where he stood: the floor, or (on a ledge, which may have scrolled) a short drop onto whatever is under him
  if(!f||f.g0==='floor'||abort){state.ground='floor';state.y=innerHeight-16;}else state.ground=null;
  runGoal=null;pendingJump=null;nextDecision=clock+(abort?.4:1.2);
  nextAuto=pwClock+POWER_EVERY;
}
function stepFlight(dt){
  const h=document.documentElement;
  if(open||dragging||h.classList.contains('gate-locked')){endFlight(true);return;}
  const f=flight;f.t+=dt;
  const base=f.fy-FL_PIVOT,lbase=(f.escape?f.ly:f.fy)-FL_PIVOT,ease=u=>u*u*(3-2*u),oy=f.py;
  if(f.phase==='up'){
    let acc=0,idx=FL_UP.length-1;
    for(let i=0;i<FL_UP.length;i++){if(f.t<acc+FL_UP[i][1]){idx=i;break;}acc+=FL_UP[i][1];}
    f.frame=FL_UP[idx][0];f.py=base;
    if(f.frame>=3&&!f.flashed){f.flashed=true;f.flashes.push({x:f.px,y:f.py,t:0});}
    f.aura=f.frame>=3?Math.min(1,f.aura+dt*2.5):f.frame===2?.25:0;
    if(f.t>=FL_UP.reduce((a,b)=>a+b[1],0)){f.phase='rise';f.t=0;}
  }else if(f.phase==='rise'){                                      // floats up
    const u=Math.min(1,f.t/FL_RISE_T);f.frame=u<.35?6:14+Math.floor(f.t*7)%4;f.aura=1;
    f.py=base+(f.hy-base)*ease(u);
    if(u>=1){f.phase='hover';f.t=0;}
  }else if(f.phase==='hover'){                                     // hangs there, bobbing gently
    f.frame=14+Math.floor(f.t*7)%4;f.aura=1;f.py=f.hy+Math.sin(f.t*2.6)*4;
    if(f.t>=FL_HOVER_T){f.phase='down';f.t=0;f.dy0=f.py;}
  }else if(f.phase==='down'){                                      // comes back down where he was
    const u=Math.min(1,f.t/FL_DOWN_T);f.frame=18;f.aura=1;
    f.py=f.dy0+(lbase-f.dy0)*ease(u);
    if(u>=1){f.phase='land';f.t=0;}
  }else if(f.phase==='land'){
    let acc=0,idx=FL_LAND.length-1;
    for(let i=0;i<FL_LAND.length;i++){if(f.t<acc+FL_LAND[i][1]){idx=i;break;}acc+=FL_LAND[i][1];}
    f.frame=FL_LAND[idx][0];f.py=lbase;
    if(f.frame>=21&&!f.flashedDown){f.flashedDown=true;f.flashes.push({x:f.px,y:f.py,t:0,small:true});}
    f.aura=f.frame>=21?Math.max(0,f.aura-dt*3):1;
    if(f.t>=FL_LAND.reduce((a,b)=>a+b[1],0)){endFlight(false);return;}
  }
  f.vy=(f.py-oy)/Math.max(dt,1e-3);              // he only moves up and down, so there is no x velocity
  drawFlight(dt);
}
function drawFlight(dt){
  const f=flight;
  // the sprite: a 200x200 canvas centred on his body, the cell drawn at half size with his body centre on the pivot
  flCv.style.transform='translate3d('+(f.px-100).toFixed(1)+'px,'+(f.py-100).toFixed(1)+'px,0)';
  const c=flCtx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,400,400);
  c.translate(200,200);
  const fr=f.frame;c.drawImage(flImg,(fr%6)*240,Math.floor(fr/6)*280,240,280,-120,-168,240,280);
  // the aura, flames, sparks and flashes, behind him
  const b=bmCtx;b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,beamCv.width,beamCv.height);b.setTransform(beamDpr,0,0,beamDpr,0,0);
  b.globalCompositeOperation='lighter';
  const t=pwClock,a=f.aura;
  if(a>0.01){
    // a tall oval of light about as big as the power-up sheet's painted glow: well past his shoulders, head and feet
    const r=70*(1+.05*Math.sin(t*19));
    b.save();b.translate(f.px,f.py);b.scale(1,1.28);
    const g=b.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,'rgba(255,236,170,'+(.55*a)+')');g.addColorStop(.45,'rgba(255,208,100,'+(.34*a)+')');
    g.addColorStop(.8,'rgba(255,186,60,'+(.12*a)+')');g.addColorStop(1,'rgba(255,170,40,0)');
    b.fillStyle=g;b.beginPath();b.arc(0,0,r,0,Math.PI*2);b.fill();b.restore();
    const moving=Math.abs(f.vy)>60;
    const back=moving?Math.atan2(-f.vy,0):-Math.PI/2;          // flames stream behind him in flight, rise when he hovers
    for(let i=0;i<9;i++){
      const an=back+(i-4)*(moving?.18:.32)+.16*Math.sin(t*13+i*1.9);
      const len=(moving?110:104)*(.75+.25*Math.sin(t*17+i*2.3))*a,w=moving?16:20;
      const dx=Math.cos(an),dy=Math.sin(an),nx=-dy,ny=dx;
      const sx=f.px-dx*14,sy=f.py-dy*14;
      const fg=b.createLinearGradient(sx,sy,sx+dx*len,sy+dy*len);
      fg.addColorStop(0,'rgba(255,240,180,'+(.38*a)+')');fg.addColorStop(.5,'rgba(255,196,70,'+(.20*a)+')');fg.addColorStop(1,'rgba(255,170,40,0)');
      b.fillStyle=fg;b.beginPath();b.moveTo(sx+nx*w,sy+ny*w);
      b.quadraticCurveTo(sx+dx*len*.55+nx*w*.6,sy+dy*len*.55+ny*w*.6,sx+dx*len,sy+dy*len);
      b.quadraticCurveTo(sx+dx*len*.55-nx*w*.6,sy+dy*len*.55-ny*w*.6,sx-nx*w,sy-ny*w);b.closePath();b.fill();
    }
    if(moving||Math.random()<.7)for(let i=0;i<(moving?3:2);i++)f.sparks.push({x:f.px+(Math.random()-.5)*(moving?30:110),y:f.py+(Math.random()-.5)*(moving?30:150),
      vx:(Math.random()-.5)*40,vy:(moving?-f.vy*.15:-40)+(Math.random()-.5)*40,l:0,m:.45+Math.random()*.5,r:1.3+Math.random()*2,w:Math.random()<.3,blue:Math.random()<.3});
  }
  for(let i=f.sparks.length-1;i>=0;i--){
    const p=f.sparks[i];p.l+=dt;if(p.l>=p.m){f.sparks.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;const k=1-p.l/p.m;
    const sg=b.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);
    sg.addColorStop(0,p.blue?'rgba(150,215,255,'+k+')':p.w?'rgba(255,255,255,'+k+')':'rgba(255,214,120,'+k+')');sg.addColorStop(1,p.blue?'rgba(120,200,255,0)':'rgba(255,190,70,0)');
    b.fillStyle=sg;b.beginPath();b.arc(p.x,p.y,p.r*3,0,Math.PI*2);b.fill();
  }
  for(let i=f.flashes.length-1;i>=0;i--){                          // the gold flash as he transforms (and a small one as he powers down)
    const q=f.flashes[i];q.t+=dt;const D=q.small?.45:.7;if(q.t>=D){f.flashes.splice(i,1);continue;}
    const u=q.t/D,R=(q.small?60:120)*Math.pow(u,.6),al=(1-u)*(q.small?.5:.85);
    const fg=b.createRadialGradient(q.x,q.y,0,q.x,q.y,R+30);
    fg.addColorStop(0,'rgba(255,250,220,'+al+')');fg.addColorStop(.6,'rgba(255,205,90,'+al*.5+')');fg.addColorStop(1,'rgba(255,190,60,0)');
    b.fillStyle=fg;b.beginPath();b.arc(q.x,q.y,R+30,0,Math.PI*2);b.fill();
    b.strokeStyle='rgba(255,236,170,'+al+')';b.lineWidth=3;b.beginPath();b.arc(q.x,q.y,R,0,Math.PI*2);b.stroke();
  }
  b.globalCompositeOperation='source-over';
}

requestAnimationFrame(function powerLoop(now){
  const dt=pwLast?Math.min(.1,(now-pwLast)/1000):0;pwLast=now;
  if(!document.hidden){
    pwClock+=dt;
    if(power)stepPower(dt);
    else if(sleigh)stepSleigh(dt);
    else if(flight)stepFlight(dt);
    else if(summon)stepSummon(dt);
    else{
      if(powerQueue&&pwClock>powerQueueUntil)powerQueue=false;
      if(powerQueue&&powerReady()){powerQueue=false;leaveSnow();startBig(powerQueueKind);}
      else if(pwClock>=nextAuto){if(powerOk())startBig(pickBig());else nextAuto=pwClock+4;}
    }
  }
  requestAnimationFrame(powerLoop);
});
/* Shift + A + C + E: held together, or typed one after another within about two seconds. */
const pwKeys=new Set();let pwSeq=[];
const typing=t=>t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
function startBig(kind){if(kind==='summon')beginSummon();else if(kind==='sleigh')beginSleigh();else if(kind==='flight')beginFlight();else beginPower();}
function pickBig(){const pool=window.ACE_XMAS?['power','flight','sleigh']:['power','flight','summon'];lastBig=pool[(pool.indexOf(lastBig)+1)%pool.length];return lastBig;}   // takes turns: kamehameha, fly, then sleigh (Christmas) or shield and hammer
/* The ace code (and the hold on the button): the beam or the flight, never the same one twice running. */
function pickAce(){return pickBig();}
/* A deliberate trigger (the codes, or holding the button) waits for powerReady(), not powerOk(): the snow is no reason
   to refuse it. Stuck in the snow it pulls him out first, as a drag does, and the moment starts from the top of the drift.
   Before, both the trigger and its queue waited on powerOk(), which the snow blocks, so the press was lost. */
function leaveSnow(){if(stuck){stuck=false;nextShiver=shiverUntil=0;floorLift=snowLift();}}
function askPower(kind){
  if(power||sleigh||flight||summon||powerQueue)return;kind=kind||'power';
  if(powerReady()){leaveSnow();startBig(kind);}
  else{powerQueue=true;powerQueueKind=kind;powerQueueUntil=pwClock+20;}
}   // a deliberate trigger waits up to 20s for him to finish a climb or jump
/* ── SLIPPING ──────────────────────────────────────────────────
   Christmas only, once the snow is up, and only now and then: standing on a button he slips. Three frames of wobble (his
   feet go, he tips back), then he falls backwards off the button with the fourth frame, tipped right over (it can be spun as he
   falls: SLIP_SPIN is the degrees a second, 0 for now), and
   lands in the drift, which fluffs up in a cloud of dust, and he is stuck (the same stuck as the blizzard's). Shift + S, L,
   I, P makes it happen the next time he is on a button (and again at any time he is, if the snow is up). Grabbing him or
   opening the chat ends it. */
const SLIP_WOBBLE=.6,SLIP_SPIN=0,SLIP_FIRST=[70,90],SLIP_EVERY=[150,240];
function standingOnButton(){const p=perches[Number(state.ground)];return state.ground==='launcher'||!!(p&&p.button);}
function maybeSlip(){
  if(!window.ACE_XMAS||slip||visit||!window.AceSnow||AceSnow.amount()<.4)return;
  if(!nextSlip){nextSlip=clock+SLIP_FIRST[0]+Math.random()*(SLIP_FIRST[1]-SLIP_FIRST[0]);return;}
  if(clock<nextSlip&&!slipWant)return;
  if(state.ground===null||state.ground==='floor'||!standingOnButton()||pendingJump||climb||runGoal!==null||holdingPoint()||clock<waveUntil||clock<landingUntil||power||sleigh||flight||summon||dragging){if(!slipWant)nextSlip=clock+6;return;}
  slipWant=false;nextSlip=clock+SLIP_EVERY[0]+Math.random()*(SLIP_EVERY[1]-SLIP_EVERY[0]);
  slip={phase:'wobble',t:0,dir:Math.random()<.5?-1:1};
  runGoal=null;pendingJump=null;nextDecision=clock+99;facing=slip.dir;play('slip');
}
function stepSlip(dt){
  slip.t+=dt;
  if(slip.phase==='wobble'){
    const cs=currentSurface();if(cs)state.y=cs.y;scroll=scrollY;state.vx=state.vy=0;facing=slip.dir;
    play('slip');renderSprite(facing);
    if(slip.t>=SLIP_WOBBLE){slip.phase='fall';slip.t=0;state.ground=null;state.bouncy=false;state.vy=-250;state.vx=slip.dir*165;}
    return;
  }
  scroll=scrollY;facing=slip.dir;slipRot+=slip.dir*SLIP_SPIN*dt;
  play('slipfall');renderSprite(facing);
  const hit=physics.step(state,dt,[{id:'floor',left:0,right:innerWidth,y:floorY()}],innerWidth);
  if(hit){                                                       // into the drift: it fluffs up and he is stuck
    slip=null;slipRot=0;lastCell=-1;
    state.x=clampX(state.x);state.ground='floor';state.vx=state.vy=0;
    stuck=true;nextShiver=shiverUntil=0;floorLift=stuckLift();state.y=floorY();
    try{sessionStorage.setItem(STUCK_KEY,'1');}catch(e){}
    if(window.AceSnow&&AceSnow.splash){AceSnow.splash(state.x,state.y,1500);AceSnow.kick(state.x,150,{v:2,clouds:26,w:150,size:2.4,h:120,al:.85,drag:2,spread:3.1});}   // a big poof that hides the swap into the stuck pose
  }
}
addEventListener('keydown',e=>{
  if(typing(e.target)||e.repeat)return;
  pwKeys.add(e.code);
  if(!e.shiftKey)return;
  const ch={KeyA:'a',KeyC:'c',KeyE:'e',KeyS:'s',KeyN:'n',KeyT:'t',KeyL:'l',KeyI:'i',KeyP:'p',KeyH:'h',KeyO:'o',KeyR:'r',KeyF:'f',KeyY:'y'}[e.code]||'';
  if(!ch){pwSeq=[];return;}
  const now=performance.now();pwSeq=pwSeq.filter(s=>now-s.t<3000);pwSeq.push({ch,t:now});
  const typed=pwSeq.slice(-3).map(s=>s.ch).join('')==='ace';
  const held=pwKeys.has('KeyA')&&pwKeys.has('KeyC')&&pwKeys.has('KeyE');
  if(typed||held){pwSeq=[];askPower('power');}                                                // Shift + A, C, E: the kamehameha
  else if(pwSeq.slice(-5).map(s=>s.ch).join('')==='santa'){pwSeq=[];askPower('sleigh');}      // Shift + S, A, N, T, A
  else if(pwSeq.slice(-4).map(s=>s.ch).join('')==='thor'&&!window.ACE_XMAS){pwSeq=[];askPower('summon');}   // Shift + T, H, O, R
  else if(pwSeq.slice(-3).map(s=>s.ch).join('')==='fly'){pwSeq=[];askPower('flight');}       // Shift + F, L, Y   (SHIFT CODES)
  else if(pwSeq.slice(-4).map(s=>s.ch).join('')==='slip'){pwSeq=[];slipWant=true;}            // Shift + S, L, I, P: slips the next time he is on a button
});
addEventListener('keyup',e=>{pwKeys.delete(e.code);});
addEventListener('blur',()=>{pwKeys.clear();pwSeq=[];});
addEventListener('resize',()=>{if(power||sleigh||flight||summon)sizeBeam();});
/* Touch and mouse: hold the "Ask Little Ace" button for 2 seconds. A normal tap
   still opens the chat; a hold that sets it off swallows the click that follows
   the release so the chat does not open as well. Moving the finger or letting
   go early cancels it. */
const POWER_HOLD_MS=2000,POWER_HOLD_SLOP=12;
let holdTimer=0,holdX=0,holdY=0,holdFired=false;
const holdCancel=()=>{clearTimeout(holdTimer);holdTimer=0;};
launcher.style.cssText+=';-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation';
launcher.addEventListener('pointerdown',e=>{
  if(e.button>0)return;
  holdFired=false;holdX=e.clientX;holdY=e.clientY;holdCancel();
  holdTimer=setTimeout(()=>{holdTimer=0;holdFired=true;if(navigator.vibrate)try{navigator.vibrate(40);}catch{}askPower(pickAce());},POWER_HOLD_MS);
});
launcher.addEventListener('pointermove',e=>{if(holdTimer&&Math.hypot(e.clientX-holdX,e.clientY-holdY)>POWER_HOLD_SLOP)holdCancel();});
for(const ev of ['pointerup','pointercancel','pointerleave'])launcher.addEventListener(ev,holdCancel);
launcher.addEventListener('contextmenu',e=>e.preventDefault());
launcher.addEventListener('click',e=>{if(holdFired){holdFired=false;e.stopImmediatePropagation();e.preventDefault();}},true);

function tick(ts){const dt=Math.min(.035,Math.max(0,(ts-last)/1000||.016));last=ts;if(document.hidden){requestAnimationFrame(tick);return;}clock+=dt;
 if(visit&&clock>visit.until){if(visit.phase!=='back'&&visit.onLeave)visit.onLeave();endVisit(false);}
 if(!open&&ready){
  const stationary=parked||motionPaused;
  /* Being carried beats everything, parking included — if you have hold of
     him he goes where you put him. The speed that picks the pose decays on
     the clock as well as being fed by the pointer, because pointermove
     simply stops firing when the hand stops: without the decay he would
     hang at a full swing for as long as you held still. */
  if(dragging){
    const decay=Math.pow(.0005,dt);dragVX*=decay;dragVY*=decay;  // a hand that stops, then lets go, drops him
    dragPose=dragPoseNow(dt);
    play('drag');renderSprite(facing);
  }
  else if(stationary){state.x=innerWidth-85;state.y=innerHeight-68;state.vx=0;state.vy=0;state.ground=null;play('idle');renderSprite(1);}
  else if(stuck){   // stuck in the snow: on the floor, not moving, one held frame
    scroll=scrollY;floorLift=stuckLift();state.vx=state.vy=0;state.ground='floor';state.y=floorY();state.x=clampX(state.x);
    runGoal=null;pendingJump=null;climb=null;nextDecision=clock+99;facing=1;
    if(!nextShiver)nextShiver=clock+5+Math.random()*7;
    if(!flImg){flImg=new Image();flImg.onload=()=>{flReady=true;};flImg.src=FLIGHT_SHEET;}   // ready for the flight out
    if(clock>=nextShiver&&!shiverUntil){shiverUntil=clock+2.25+Math.random()*1.5;play('shiver');}   // one shiver
    if(shiverUntil&&clock>=shiverUntil){shiverUntil=0;nextShiver=clock+99;if(!(power||sleigh||summon)&&beginFlight(true)!==false){}else nextShiver=clock+1;}   // then he flies up out of the drift
    play(shiverUntil?'shiver':'stuck');renderSprite(facing);
  }
  else if(slip){stepSlip(dt);}
  else if(sleigh){scroll=scrollY;facing=sleigh.facing;play(sleigh.clip);renderSprite(facing);}   // the sleigh sequence moves him (stepSleigh); this only draws
  else if(flight){scroll=scrollY;}   // flying: drawn by stepFlight on its own canvas, the page sprite is hidden
  else{
   const dy=scrollY-scroll;scroll=scrollY;
   if(floorLift>0&&state.ground==='floor'){const r=stuckLift();floorLift=Math.max(r,floorLift-SINK_PX_S*dt);if(floorLift<=r){floorLift=r;stuck=true;}}   // on top of the snow he slowly sinks back in
   if(clock-lastSurfaceUpdate>.12||dy){scan();lastSurfaceUpdate=clock;}
   maybeSlip();

   /* ── CLIMBING ────────────────────────────────────────────────
      He walks to the left edge of the block first, then goes up its face.
      While ascending he is on no surface at all, so the whole ground and
      gravity section below is skipped — otherwise physics.step would pull
      him straight back down the paragraph he is trying to climb. */
   let ascending=false;
   if(climb){
     const r=climb.el.getBoundingClientRect();
     const gone=r.bottom<60||r.top>innerHeight-30||r.width<100;
     if(gone){
       const cc=climbables.find(c=>c.el===climb.el);if(cc)cc.rest=clock+25;
       climb=null;state.vy=Math.max(60,state.vy);nextDecision=clock+.4;
     }else if(Math.abs(state.x-climb.x)<12){
       ascending=true;
       state.ground=null;state.vy=0;state.vx=0;runGoal=null;pendingJump=null;
       state.x=climb.x;
       state.y-=CLIMB_SPEED*dt;
       facing=1;play('climb');
       if(state.y<=r.top){
         /* Made the top. The block becomes a surface for as long as he is
            standing on it — copy is not a perch anyone can jump to, but
            having climbed it he has to have somewhere to be. */
         state.y=r.top;textSurface={el:climb.el};state.ground='text';
         const cc=climbables.find(c=>c.el===climb.el);if(cc)cc.rest=clock+25;
         climb=null;ascending=false;nextDecision=clock+.6;
       }
     }else{
       runGoal=climb.x;                    // still walking to the foot of it
     }
   }

   if(!ascending){
   let ground=currentSurface();
   if(ground&&ground.id!=='floor'&&ground.id!=='visit'&&ground.id!=='launcher'&&!climb){
     if(runGoal!==null&&runGoal>=ground.left&&runGoal<=ground.right)runGoal=inward(ground,runGoal);   // a walk along it, not off it
     else if(runGoal===null&&!pendingJump){const safe=inward(ground,state.x);if(Math.abs(safe-state.x)>1)state.x+=Math.sign(safe-state.x)*Math.min(Math.abs(safe-state.x),RUN_SPEED*dt);}   // drifted to an end: back in
   }
   if(ground){state.y=ground.y;if((ground.id!=='visit'&&state.y<120)||state.y>innerHeight+30||state.x<ground.left+6||state.x>ground.right-6){state.ground=null;state.y=Math.max(-15,Math.min(innerHeight-20,state.y));state.vy=100;ground=null;runGoal=null;pendingJump=null;}}
   else if(dy){state.y=Math.max(-15,Math.min(innerHeight-35,state.y-dy));if(Math.abs(dy)>60){state.vy=Math.max(100,state.vy);pendingJump=null;}}
   if(pendingJump&&clock>=crouchUntil){const p=surfaces.find(p=>p.id===pendingJump.id);if(p){const tx=inward(p,pendingJump.x);physics.jump(state,{x:tx,y:p.y});facing=Math.sign(state.vx)||facing;}pendingJump=null;ground=null;}
   if(state.ground!==null){
    if(holdingPoint()||clock<waveUntil){
      /* Holding a gesture (the point, or the hello wave): no walking, no
         decisions, no fidgeting. */
      state.vx=0;facing=1;
    }else if(runGoal!==null&&!pendingJump){
     const dx=runGoal-state.x;state.vx=Math.sign(dx)*RUN_SPEED;facing=Math.sign(dx)||facing;
     /* Clamped here, where the move happens, rather than only by the
        blanket clamp further down — so the arrival test below sees the
        position he was actually allowed to take. */
     state.x=clampX(state.x+state.vx*dt);
     const pinned=state.x<=EDGE||state.x>=innerWidth-EDGE;
     if(Math.abs(runGoal-state.x)<8||pinned){
       runGoal=null;state.vx=0;nextDecision=clock+.16;
     }
    }else state.vx=0;
    /* A visitor who starts moving again cuts a rest short. Not a climb in
       progress (it books its own long wait) and not a held point. */
    if(busy()&&!climb&&!holdingPoint()&&nextDecision-clock>1.2)nextDecision=clock+.3;
    if(visit&&!holdingPoint()){
      if(visit.phase==='start'){
        const v=visitSurface();
        if(v){visit.phase='out';leap((v.left+v.right)/2,v.y);}else endVisit(false);
      }else if(visit.phase==='point'){
        const l=launcherSurface();
        visit.phase='back';if(visit.onLeave)visit.onLeave();
        if(l)leap((l.left+l.right)/2,l.y);else endVisit(true);
      }
    }
    else if(clock>=nextDecision&&clock>=waveUntil&&!pendingJump&&runGoal===null&&!holdingPoint())decide();
   }else{const fell=state.vy;const hit=physics.step(state,dt,surfaces,innerWidth);
     if(window.ACE_XMAS&&window.AceSnow&&AceSnow.splash&&fell>300&&((hit&&hit.id==='floor')||(!hit&&state.vy<0&&Math.abs(state.y-floorY())<2)))AceSnow.splash(state.x,state.y,fell);   // thrown into the snow: it fluffs and sprays
     /* Only a real drop is worth a landing. Stepping between two ledges on
        the same line arrives at ~130px/s against 500+ for any actual jump,
        and playing `land` for it put a stumble in the middle of a run. */
     if(hit){if(fell>260)landingUntil=clock+.23;nextDecision=clock+.28+Math.random()*.5;target=null;remember(hit.id);
     /* The old sheet pointed sideways, so he had to walk to the button's
        left end first to have something to point AT. This one points at the
        floor under him, which is the button itself — so it plays where he
        lands and the walk-up is gone. */
     const p=perches[Number(hit.id)];
     if(visit){
       if(hit.id==='visit'){
         pointKind='point';pointUntil=clock+VISIT_POINT;play('point');visit.phase='point';nextDecision=clock+99;
         if(visit.onPoint)visit.onPoint();
       }else if(visit.phase==='back')endVisit(true);
       else{visit.phase='start';}          // came down short: try again from here
     }
     else if(p){
       /* Two ways to point. On a button he can point DOWN at it, as before, or
          (when there is another button overhead) point UP at that one; the two
          are used interchangeably. Standing on anything else, a tray or a card,
          with a button above him, he points up at it. Nothing above and nothing
          under him that is a button: no gesture. */
       const up=buttonAbove();
       if(p.button&&Math.random()<.75){
         pointKind=(up&&Math.random()<.5)?'pointup':'point';
         pointUntil=clock+POINT_HOLD;play(pointKind);runGoal=null;nextDecision=pointUntil+.2;
       }else if(!p.button&&up&&Math.random()<.7){
         pointKind='pointup';
         pointUntil=clock+POINT_HOLD;play('pointup');runGoal=null;nextDecision=pointUntil+.2;
       }
     }
   }}
   if(state.y>innerHeight+60){state.y=floorY();state.ground='floor';state.vy=state.vx=0;nextDecision=clock+.5;}
   }
   state.x=clampX(state.x);

   /* ── WHICH CLIP ──────────────────────────────────────────────
      Ordered by urgency: a deliberate gesture beats the physics, the
      physics beat locomotion, locomotion beats standing still. */
   if(!ascending){
     if(clock<waveUntil&&state.ground!==null)play('wave');
     else if(holdingPoint())play(pointKind);
     else if(pendingJump)play('crouch');
     else if(clock<landingUntil)play('land');
     else if(state.ground===null)play(state.vy<-180?'rise':state.vy<100?'apex':'fall');
     else if(Math.abs(state.vx)>1)play('run');
     else{
       play('idle');
       // Look toward the cursor when he has nothing else to do.
       if(Math.abs(cursorX-state.x)>60)facing=cursorX>state.x?1:-1;
     }
   }
   renderSprite(facing);
  }
  /* Two bounces per cycle — one per step — derived from the clip's own
     length so it stays in step if the cycle is ever re-cut. Nothing else
     offsets the sprite, so this is the only place y is nudged away from
     where the physics put his feet. */
  const bob=clipName==='run'
    ?-RUN_BOB*Math.abs(Math.sin((clock-clipStart)*Math.PI*2*CLIPS.run.fps/CLIPS.run.f.length))
    :0;
  pet.style.transform=`translate3d(${(state.x-SPRITE_W/2).toFixed(1)}px,${(state.y-FEET_Y/2+bob).toFixed(1)}px,0)`+(slipRot?` rotate(${slipRot.toFixed(1)}deg)`:'');
  const shadowY=state.ground!==null?state.y:floorY();const distance=Math.max(0,shadowY-state.y);shadow.style.opacity=(stationary||stuck||flight||(sleigh&&sleigh.hidden))?'0':String(Math.max(.08,.6-distance/450));shadow.style.transform=`translate3d(${state.x-26}px,${shadowY-3}px,0) scale(${Math.max(.35,1-distance/600)},1)`;
 }else if(open&&ready){
  /* Chatting: parked beside the panel rather than roaming, and drawn from
     the big sheet rather than the atlas. He eases into place — a glide,
     not a walk cycle, which is what "grows big and stands next to it"
     reads as without simulating a whole run-over. The gesture schedule
     runs on `clock`, which only advances while the page is visible, so the
     15s cap means 15s of the chat actually being looked at rather than 15s
     of wall clock. */
  if(slip){slip=null;slipRot=0;}
  const t=chatLayout();
  if(t){
    const cw=t.w.toFixed(1)+'px',ch=t.h.toFixed(1)+'px';
    if(cw!==chatW){chatCanvas.style.width=chatW=cw;}
    if(ch!==chatH){chatCanvas.style.height=chatH=ch;}
    chatX+=(t.x-chatX)*Math.min(1,dt*CHAT_EASE);
    chatY+=(t.y-chatY)*Math.min(1,dt*CHAT_EASE);
    if(clock>=nextChatPose){
      chatGestureStart=clock;
      nextChatPose=clock+CHAT_PLAY_LEN+CHATPOSE_MIN+Math.random()*(CHATPOSE_MAX-CHATPOSE_MIN);
    }
    let cell=0;                                   // rests on frame 0, where every play also begins and ends
    if(chatGestureStart>=0){
      const t=clock-chatGestureStart+CHAT_LEAD;
      if(t>=CHAT_GESTURE_LEN)chatGestureStart=-1;else cell=chatCellAt(t);
    }
    renderChat(cell);
    pet.style.transform=`translate3d(${chatX.toFixed(1)}px,${chatY.toFixed(1)}px,0)`;
  }
  shadow.style.opacity='0';
 }else scroll=scrollY;
 requestAnimationFrame(tick);
}
/* A narrower window can leave his goal outside the new walkable strip, so
   it is dropped rather than carried across the resize. */
window.addEventListener('resize',()=>{scan();state.x=clampX(state.x);runGoal=null;if(state.y>innerHeight)state.y=floorY();});
scan();requestAnimationFrame(tick);
})();
