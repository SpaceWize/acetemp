(function(root){
'use strict';const GRAVITY=1650;
/* Thrown, he is a ball: s.bouncy is set only by a throw (never by a jump,
   whose landings stay dead), and while it holds he rebounds off whatever he
   hits instead of landing on it. Each floor hit keeps RESTITUTION of the
   downward speed and SKID of the sideways; once an impact is below
   BOUNCE_MIN he lands for real and the flag clears. CEILING is the feet
   line that keeps his head under the fixed header. */
const RESTITUTION=.55,SKID=.82,BOUNCE_MIN=380,WALL_BOUNCY=.65,CEILING=200;
function step(s,dt,platforms,width){
 dt=Math.min(dt,.035);const prevY=s.y,prevX=s.x;s.x+=s.vx*dt;s.y+=s.vy*dt+.5*GRAVITY*dt*dt;s.vy+=GRAVITY*dt;
 const wall=s.bouncy?WALL_BOUNCY:.5;
 if(s.x<36){s.x=36;s.vx=Math.abs(s.vx)*wall;}if(s.x>width-36){s.x=width-36;s.vx=-Math.abs(s.vx)*wall;}
 if(s.bouncy&&s.y<CEILING&&s.vy<0){s.y=CEILING;s.vy=Math.abs(s.vy)*RESTITUTION;}
 let landed=null;
 if(s.vy>=0){for(const p of platforms){if(prevY<=p.y+1&&s.y>=p.y){const t=s.y===prevY?1:(p.y-prevY)/(s.y-prevY);const x=prevX+(s.x-prevX)*t;if(x>=p.left+5&&x<=p.right-5&&(!landed||p.y<landed.y))landed=p;}}}
 if(landed&&s.bouncy&&s.vy>BOUNCE_MIN){s.y=landed.y;s.vy=-s.vy*RESTITUTION;s.vx*=SKID;return null;}
 if(landed){s.y=landed.y;s.vy=0;s.vx=0;s.ground=landed.id;s.bouncy=false;}
 return landed;
}
function jump(s,target){const rise=s.y-target.y;const vy=-Math.sqrt(2*GRAVITY*(Math.max(0,rise)+95));const discriminant=vy*vy+2*GRAVITY*(target.y-s.y);const time=(-vy+Math.sqrt(Math.max(0,discriminant)))/GRAVITY;s.vy=vy;s.vx=Math.max(-340,Math.min(340,(target.x-s.x)/Math.max(.3,time)));s.ground=null;return time;}
const api={step,jump,GRAVITY};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AcePhysics=api;
})(typeof window!=='undefined'?window:globalThis);
