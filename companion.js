/* ═══════════════════════════════════════════════════════════════
   LITTLE ACE — the canvas companion and his chat panel.

   He walks the page. At load the script asks the document which of its
   elements actually draw a horizontal edge — cards, trays, buttons, the
   hairline rules between blocks — and treats those as platforms; every
   frame it re-measures the ones on screen, so he climbs the real layout
   and rides it as the page scrolls. physics.js does the ballistics,
   knowledge.js answers the questions. Everything runs locally — the
   chat never makes a network request.

   Depends on window.AceKnowledge and window.AcePhysics; if either script
   failed to load, this one does nothing rather than half-building a
   companion that cannot move or talk.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const knowledge=window.AceKnowledge,physics=window.AcePhysics;if(!knowledge||!physics)return;

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
const launcher=document.createElement('button');launcher.type='button';launcher.className='ace-launcher';launcher.innerHTML='<span aria-hidden="true">♠</span><span>Ask Little Ace</span>';launcher.setAttribute('aria-controls','ace-chat');launcher.setAttribute('aria-expanded','false');document.body.append(launcher);
const panel=document.createElement('section');panel.id='ace-chat';panel.className='ace-chat';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','ace-chat-title');panel.innerHTML='<div class="ace-chat-head"><span class="ace-chat-symbol" aria-hidden="true">♠</span><div><h2 id="ace-chat-title">Little Ace</h2><p>Your guide to Ace Spaders</p></div><button type="button" class="ace-chat-close" aria-label="Close chat">×</button></div><div class="ace-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></div><div class="ace-chat-suggestions" aria-label="Suggested questions"><button type="button">Advisory fees</button><button type="button">About Ace</button><button type="button">Upcoming events</button></div><form class="ace-chat-form"><label class="ace-sr" for="ace-question">Ask about Ace or the website</label><input id="ace-question" name="question" maxlength="600" autocomplete="off" placeholder="Ask about Ace, services, events…" required><button type="submit" aria-label="Send question">↑</button></form><div class="ace-chat-foot"><span>Published-site answers · stays in your browser</span><button class="ace-park" type="button">Park Little Ace</button></div>';document.body.append(panel);
const log=panel.querySelector('.ace-chat-messages'),input=panel.querySelector('input'),close=panel.querySelector('.ace-chat-close'),parkButton=panel.querySelector('.ace-park');

/* Reduced motion parks him by default rather than hiding him: the chat is
   the point, and the walking is the part that has to yield. */
const calm=matchMedia('(prefers-reduced-motion: reduce)');
let open=false,lastTopic=null,previousFocus=null,parked=false,motionPaused=calm.matches,ready=false;
try{parked=sessionStorage.getItem('ace-parked')==='yes';}catch{}
calm.addEventListener('change',e=>{motionPaused=e.matches;if(!motionPaused){state.ground=null;state.vy=0;nextDecision=clock+.8;}});

function addMessage(text,who,links=[]){const el=document.createElement('div');el.className='ace-message '+who;const label=document.createElement('span');label.className='speaker';label.textContent=who==='user'?'YOU':'LITTLE ACE';const p=document.createElement('p');p.textContent=text;el.append(label,p);if(links.length){const list=document.createElement('div');list.className='ace-message-links';for(const [title,href] of links){const a=document.createElement('a');a.textContent=title+' ↗';a.href=href;if(href.startsWith('https:')){a.target='_blank';a.rel='noopener';}list.append(a);}el.append(list);}log.append(el);while(log.children.length>50)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;}
addMessage('Hi, I’m Little Ace, the automated site guide. I can explain Ace’s work, compare the services, or find your next gathering. I answer from published site information; for personal advice, speak with Ace.','bot');

/* px/s^-1-ish ease rate he glides toward the chat-stand spot at, and the
   window the idle "he's alive" gesture is re-rolled inside of. MIN keeps
   two plays from ever landing back to back; MAX is the 9s cap. */
const CHAT_EASE=6, CHATPOSE_MIN=4, CHATPOSE_MAX=9;
let nextChatPose=0,chatCloseTimer=null;

/* ── THE CHAT STANCE ─────────────────────────────────────────
   Beside the panel he is drawn as tall as the panel itself, roughly three
   times any other pose. Taking that from the atlas would mean upscaling a
   223px cell past 700px, and the gesture is all in his eyes — precisely
   what upscaling ruins. So this renders from its own sheet at the source
   art's native size, on its own canvas, fetched only when someone actually
   opens the chat. Geometry is printed by tools/build_atlas.py. */
const CHAT_CELL_W=704,CHAT_CELL_H=1456,CHAT_FIGURE_H=1400,CHAT_FIGURE_W=613;
const CHAT_FOOT_PAD=16;  // px of cell under his shoes, from CHAT_FEET_Y
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
const CHAT_GESTURE=[
  [0,0.35],                      // at the viewer
  [5,0.06],[2,0.10],[3,0.06],    // blink — and behind it, the eyes redirect
  [4,1.60],                      // open again, looking at the panel
  [7,0.06],[6,0.10],[5,0.06],    // blink back
  [8,0.45],                      // at the viewer again
];
const CHAT_GESTURE_LEN=CHAT_GESTURE.reduce((a,f)=>a+f[1],0);
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
let chatX=0,chatY=0;
function loadChatSheet(){
  if(chatAsked)return;
  chatAsked=true;
  chatImg.onload=()=>{chatReady=true;lastChatCell=-1;};
  chatImg.src='assets/images/ace-chat-pose.webp';
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
 previousFocus=document.activeElement;open=true;panel.hidden=false;launcher.hidden=true;pet.classList.add('is-chatting');pet.setAttribute('aria-expanded','true');launcher.setAttribute('aria-expanded','true');shadow.style.opacity='0';input.focus({preventScroll:true});log.scrollTop=log.scrollHeight;
 /* Fresh schedule every time the chat opens, so the 15s cap counts from
    when he actually appears, not from some earlier session. */
 /* Only fetch the big sheet where he is actually drawn from it. Below
    900px he stays hidden, and a phone should not pay 900KB for a picture
    it will never show. */
 if(innerWidth>=900)loadChatSheet();
 chatGestureStart=-1;nextChatPose=clock+1+Math.random()*(CHATPOSE_MAX-1);
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
pet.addEventListener('click',showChat);launcher.addEventListener('click',showChat);close.addEventListener('click',hideChat);panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hideChat();}});
function ask(q){q=q.trim();if(!q)return;addMessage(q,'user');const a=knowledge.answer(q,lastTopic);lastTopic=a.id;addMessage(a.text,'bot',a.links);input.value='';input.focus({preventScroll:true});}
panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();ask(input.value);});panel.querySelectorAll('.ace-chat-suggestions button').forEach(b=>b.addEventListener('click',()=>ask(b.textContent)));
function updatePark(){parkButton.textContent=parked?'Let Little Ace roam':'Park Little Ace';}
parkButton.addEventListener('click',()=>{parked=!parked;try{sessionStorage.setItem('ace-parked',parked?'yes':'no');}catch{}updatePark();if(!parked){state.ground=null;state.vy=0;nextDecision=clock+.5;}});updatePark();

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
  idle  :{f:[0,1,2,3,4,5,6,7],       fps:2.5,loop:true, dir:0},
  wave  :{f:[8,9,10,11,12],          fps:9,  loop:true, dir:0},
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
     right to it — dir:0 keeps it from ever being mirrored. Eight frames at
     6fps lean in, point, and straighten up again in 1.3s; the clip is a
     one-shot, so it then holds the plain stand it ends on. */
  point :{f:[42,43,44,45,46,47,48,49],fps:6,  loop:false,dir:0},
  /* Held up by the hood. Not played on a clock: the frame is chosen from how
     fast he is being dragged, so fps is unused and clipFrame() special-cases
     it. The five are ordered by how far the body has swung out from under the
     pivot. The art swings him to the RIGHT of the hood, which is what
     trailing behind a hand moving LEFT looks like — hence dir:-1. */
  drag  :{f:[50,51,52,53,54],        fps:0,  loop:false,dir:-1},
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
img.src='assets/images/ace-atlas.webp';

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
function clipDone(){
  const c=CLIPS[clipName]||CLIPS.idle;
  return !c.loop&&(clock-clipStart)>=c.f.length/c.fps;
}
function renderSprite(facing){
  if(!ready)return;
  const cell=clipFrame();
  const dir=(CLIPS[clipName]||CLIPS.idle).dir;
  const flip=dir!==0&&facing!==dir;
  if(cell===lastCell&&flip===lastFlip)return;   // nothing changed, skip the blit
  lastCell=cell;lastFlip=flip;
  const sx=(cell%ATLAS_COLS)*CELL_W,sy=Math.floor(cell/ATLAS_COLS)*CELL_H;
  ctx.clearRect(0,0,CELL_W,CELL_H);
  ctx.save();
  if(flip){ctx.translate(CELL_W,0);ctx.scale(-1,1);}
  ctx.drawImage(img,sx,sy,CELL_W,CELL_H,0,0,CELL_W,CELL_H);
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
    if(el.closest('.site-head,.mnav,.foot,#ace-chat,.sprite,.skip,'+
                  '.ace-companion,.ace-shadow,.ace-launcher,[data-hero] .hero__content'))continue;
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
    const dupe=kept.some(k=>Math.abs(k.y-p.y)<PERCH_MIN_GAP&&
      Math.min(k.right,p.right)-Math.max(k.left,p.left)>Math.min(k.right-k.left,p.right-p.left)*.8);
    if(!dupe)kept.push(p);
  }
  return kept;
}

const perches=findPerches();
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
    if(el.closest('.site-head,.mnav,.foot,#ace-chat,.ace-companion,[data-hero] .hero__content'))continue;
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
let climb=null,textSurface=null,pointUntil=0,waveUntil=0;
const state={x:Math.max(70,innerWidth-160),y:innerHeight-20,vx:0,vy:0,ground:'floor'};
let cursorX=innerWidth/2;document.addEventListener('pointermove',e=>{cursorX=e.clientX;},{passive:true});

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
const DRAG_STEPS=[150,320,700,1200];// px/s thresholds between the five poses
let dragging=false,dragPointer=null,dragOffX=0,dragOffY=0,
    dragSpeed=0,dragLastT=0,dragDownX=0,dragDownY=0,suppressClick=false;

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
    try{pet.setPointerCapture(dragPointer);}catch{}
    pet.classList.add('is-dragging');
    climb=null;runGoal=null;pendingJump=null;pointUntil=0;
    state.vx=0;state.vy=0;state.ground=null;
  }
  const nx=clampX(e.clientX+dragOffX),dx=nx-state.x;
  /* Smoothed against the clock, not against the sample count — pointermove
     fires at the device's rate, not the frame rate, so a raw per-event
     delta reads as a different speed on a 120Hz trackpad than on a 60Hz
     mouse. */
  const dtms=Math.max(6,e.timeStamp-dragLastT);dragLastT=e.timeStamp;
  dragSpeed=dragSpeed*.7+(Math.abs(dx)/(dtms/1000))*.3;
  if(Math.abs(dx)>1.5)facing=dx>0?1:-1;
  state.x=nx;state.y=Math.max(-10,Math.min(innerHeight+40,e.clientY+dragOffY));
  e.preventDefault();
},{passive:false});

function endDrag(e){
  if(e.pointerId!==dragPointer)return;
  dragPointer=null;
  if(!dragging)return;
  dragging=false;dragSpeed=0;
  pet.classList.remove('is-dragging');
  try{pet.releasePointerCapture(e.pointerId);}catch{}
  /* Dropped, not thrown: the hand's momentum is deliberately not carried
     into vx. A flick would otherwise fire him across the page. */
  state.ground=null;state.vx=0;state.vy=0;nextDecision=clock+.5;
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
function scan(){surfaces=[];for(let i=0;i<perches.length;i++){const p=perches[i],r=p.el.getBoundingClientRect();const y=perchY(p,r);if(r.width>PERCH_MIN_WIDTH&&y>150&&y<innerHeight-60&&r.right>60&&r.left<innerWidth-60){surfaces.push({id:String(i),left:Math.max(20,r.left),right:Math.min(innerWidth-20,r.right),y,el:p.el});}}surfaces=bridge(surfaces);const t=state.ground==='text'&&textSurfaceNow();if(t)surfaces.push(t);const l=launcherSurface();if(l)surfaces.push(l);surfaces.push({id:'floor',left:0,right:innerWidth,y:innerHeight-16});}
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
function currentSurface(){if(state.ground==='floor')return {id:'floor',left:0,right:innerWidth,y:innerHeight-16};if(state.ground==='text')return textSurfaceNow();if(state.ground==='launcher')return launcherSurface();if(state.ground===null)return null;
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

const SURFACE_EDGE=60;
/* How often a decision made ON THE FLOOR is just "walk somewhere else
   along it" rather than a hunt for something to jump onto. The floor is
   exempt from the ledge rule below — it always has room, so applying that
   there would mean he never climbed anything — but the exemption also sent
   every floor decision straight to the jump hunt, which is where most of
   the remaining hopping came from. */
const FLOOR_ROAM=.55;
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
    const r=c.el.getBoundingClientRect();
    if(r.top<90||r.bottom>innerHeight-40)continue;
    const rise=state.y-r.top;
    if(rise<70||rise>460)continue;
    const x=clampX(r.left+16);
    best.push({el:c.el,x,topY:r.top,cost:Math.abs(x-state.x)+rise*.4+Math.random()*90});
  }
  if(!best.length)return null;
  best.sort((a,b)=>a.cost-b.cost);
  return best[0];
}

function choose(){
 const ground=currentSurface();
 /* Comfortably in the middle of a wide ledge: this is what "flat surface,
    so he runs" means, and it is the actual bug behind the jumping-bean
    complaint. inReach() below deliberately excludes the surface he is
    already standing on, so every choice it offers is a jump to somewhere
    else — even with 800px of the ledge he is on left to walk. That has to
    be decided here, before inReach() is ever consulted, or it never gets
    a turn. */
 if(ground&&ground.id!=='floor'&&ground.right-ground.left>140&&
    state.x-ground.left>SURFACE_EDGE&&ground.right-state.x>SURFACE_EDGE){
   const x=Math.random()<.5?ground.right-35:ground.left+35;
   runGoal=clampX(x);nextDecision=clock+.5;return;
 }
 /* On the floor: often enough, just walk it. He still explores the page,
    he simply does more of it on foot. */
 if(ground&&ground.id==='floor'&&Math.random()<FLOOR_ROAM){
   runGoal=clampX(state.x+(Math.random()<.5?-1:1)*(140+Math.random()*220));
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
   runGoal=clampX(tx);nextDecision=clock+.6;return;
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
   +recentBonus(p.id)})).sort((a,b)=>a.score-b.score);
 const p=scored[Math.min(scored.length-1,Math.random()<.25?1:0)].p;
 /* Spread landings across the ledge instead of always touching down where
    he took off, so a wide tray gets walked rather than stood on. */
 const x=Math.max(p.left+35,Math.min(p.right-35,state.x+(Math.random()-.5)*260));
 target={id:p.id,x,y:p.y};
 const distance=Math.abs(x-state.x);
 /* Too far to jump: walk to the near end of the current surface first.
    Clamped for the same reason — on the floor, ground.left is 0, so the
    unclamped run-up target was 35px off the left of the screen. */
 if(distance>230&&ground){runGoal=clampX(ground.id==='floor'?Math.max(ground.left+45,Math.min(ground.right-45,x)):(x>state.x?ground.right+35:ground.left-35));nextDecision=clock+.45;return;}
 pendingJump=target;crouchUntil=clock+.16;runGoal=null;
}
/* dt is clamped at BOTH ends. The cap is the usual "do not let a long
   stall teleport him"; the floor at zero matters more than it looks. Every
   timer he has — pointUntil, nextDecision, landingUntil, crouchUntil,
   nextChatPose — is a comparison against `clock`, so a single negative dt
   rewinds the clock and strands every one of them in the future at once.
   That leaves him frozen mid-gesture with no decisions, alive but stuck,
   which is exactly the state he was found in. */
function tick(ts){const dt=Math.min(.035,Math.max(0,(ts-last)/1000||.016));last=ts;if(document.hidden){requestAnimationFrame(tick);return;}clock+=dt;
 if(!open&&ready){
  const stationary=parked||motionPaused;
  /* Being carried beats everything, parking included — if you have hold of
     him he goes where you put him. The speed that picks the pose decays on
     the clock as well as being fed by the pointer, because pointermove
     simply stops firing when the hand stops: without the decay he would
     hang at a full swing for as long as you held still. */
  if(dragging){
    dragSpeed*=Math.pow(.002,dt);   // ~half a second from a hard yank to still
    dragPose=dragSpeed<DRAG_STEPS[0]?0:dragSpeed<DRAG_STEPS[1]?1
            :dragSpeed<DRAG_STEPS[2]?2:dragSpeed<DRAG_STEPS[3]?3:4;
    play('drag');renderSprite(facing);
  }
  else if(stationary){state.x=innerWidth-85;state.y=innerHeight-68;state.vx=0;state.vy=0;state.ground=null;play('idle');renderSprite(1);}
  else{
   const dy=scrollY-scroll;scroll=scrollY;
   if(clock-lastSurfaceUpdate>.12||dy){scan();lastSurfaceUpdate=clock;}

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
         climb=null;ascending=false;nextDecision=clock+.6;
       }
     }else{
       runGoal=climb.x;                    // still walking to the foot of it
     }
   }

   if(!ascending){
   let ground=currentSurface();
   if(ground){state.y=ground.y;if(state.y<120||state.y>innerHeight+30||state.x<ground.left+6||state.x>ground.right-6){state.ground=null;state.y=Math.max(-15,Math.min(innerHeight-20,state.y));state.vy=100;ground=null;runGoal=null;pendingJump=null;}}
   else if(dy){state.y=Math.max(-15,Math.min(innerHeight-35,state.y-dy));if(Math.abs(dy)>60){state.vy=Math.max(100,state.vy);pendingJump=null;}}
   if(pendingJump&&clock>=crouchUntil){const p=surfaces.find(p=>p.id===pendingJump.id);if(p){const tx=Math.max(p.left+30,Math.min(p.right-30,pendingJump.x));physics.jump(state,{x:tx,y:p.y});facing=Math.sign(state.vx)||facing;}pendingJump=null;ground=null;}
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
    if(clock>=nextDecision&&clock>=waveUntil&&!pendingJump&&runGoal===null&&!holdingPoint()){choose();nextDecision=Math.min(nextDecision,clock+2+Math.random()*2);}
   }else{const fell=state.vy;const hit=physics.step(state,dt,surfaces,innerWidth);
     /* Only a real drop is worth a landing. Stepping between two ledges on
        the same line arrives at ~130px/s against 500+ for any actual jump,
        and playing `land` for it put a stumble in the middle of a run. */
     if(hit){if(fell>260)landingUntil=clock+.23;nextDecision=clock+.28+Math.random()*.5;target=null;remember(hit.id);
     /* The old sheet pointed sideways, so he had to walk to the button's
        left end first to have something to point AT. This one points at the
        floor under him, which is the button itself — so it plays where he
        lands and the walk-up is gone. */
     const p=perches[Number(hit.id)];
     if(p&&p.button&&Math.random()<.75){
       pointUntil=clock+POINT_HOLD;play('point');runGoal=null;nextDecision=pointUntil+.2;
     }
   }}
   if(state.y>innerHeight+60){state.y=innerHeight-16;state.ground='floor';state.vy=state.vx=0;nextDecision=clock+.5;}
   }
   state.x=clampX(state.x);

   /* ── WHICH CLIP ──────────────────────────────────────────────
      Ordered by urgency: a deliberate gesture beats the physics, the
      physics beat locomotion, locomotion beats standing still. */
   if(!ascending){
     if(clock<waveUntil&&state.ground!==null)play('wave');
     else if(holdingPoint())play('point');
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
  pet.style.transform=`translate3d(${(state.x-SPRITE_W/2).toFixed(1)}px,${(state.y-FEET_Y/2+bob).toFixed(1)}px,0)`;
  const shadowY=state.ground!==null?state.y:innerHeight-16;const distance=Math.max(0,shadowY-state.y);shadow.style.opacity=stationary?'0':String(Math.max(.08,.6-distance/450));shadow.style.transform=`translate3d(${state.x-26}px,${shadowY-3}px,0) scale(${Math.max(.35,1-distance/600)},1)`;
 }else if(open&&ready){
  /* Chatting: parked beside the panel rather than roaming, and drawn from
     the big sheet rather than the atlas. He eases into place — a glide,
     not a walk cycle, which is what "grows big and stands next to it"
     reads as without simulating a whole run-over. The gesture schedule
     runs on `clock`, which only advances while the page is visible, so the
     15s cap means 15s of the chat actually being looked at rather than 15s
     of wall clock. */
  const t=chatLayout();
  if(t){
    chatCanvas.style.width=t.w.toFixed(1)+'px';
    chatCanvas.style.height=t.h.toFixed(1)+'px';
    chatX+=(t.x-chatX)*Math.min(1,dt*CHAT_EASE);
    chatY+=(t.y-chatY)*Math.min(1,dt*CHAT_EASE);
    if(clock>=nextChatPose){
      chatGestureStart=clock;
      nextChatPose=clock+CHATPOSE_MIN+Math.random()*(CHATPOSE_MAX-CHATPOSE_MIN);
    }
    let cell=0;                                   // at the viewer, between gestures
    if(chatGestureStart>=0){
      const c=chatCellAt(clock-chatGestureStart);
      if(c<0)chatGestureStart=-1;else cell=c;
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
window.addEventListener('resize',()=>{scan();state.x=clampX(state.x);runGoal=null;if(state.y>innerHeight)state.y=innerHeight-16;});
scan();requestAnimationFrame(tick);
})();
