const cv=document.querySelector("#game"),ctx=cv.getContext("2d");
const W=8,H=14,S=45,COLORS=["#59dc76","#ff5f78","#43aef5","#ffd85c"];
let board=Array.from({length:H},()=>Array(W).fill(null)),score=0,special=0,chain=0,chainPoints=0,GOAL=300,gameOver=false,cleared=false,playerClass=null;
const hero={x:3.5,y:H-1.55,vx:0,vy:0,w:.52,h:.92,onGround:false,grab:null,stun:0,charge:0,face:1,walk:0,attackT:0,attackDir:"right",attackPower:1,kickT:0,grabT:0,squashT:0,squeezeT:0,squeezeDir:0,carry:null,jumps:0,grabHold:0,grabColorTick:0,floating:false};
let pairs=[],pairSeq=0,spawnClock=0,keys={},last=performance.now(),fallSpeed=.00075,effects=[];

function makeSlime(type,hard=false){return{color:COLORS[type],hp:hard?4:2,hard,frozen:false}}
function topFree(x){for(let y=0;y<H;y++)if(board[y][x])return y-1;return H-1}
function chooseColumn(type){
 let sc=Array(W).fill(0).map((_,x)=>{let y=topFree(x),s=Math.random()*1.8;if(y>=0){
  for(const [dx,dy] of [[-1,0],[1,0],[0,1]]){let nx=x+dx,ny=y+dy;if(nx>=0&&nx<W&&ny<H&&board[ny]?.[nx]?.color===COLORS[type])s+=2.4}
  s-=Math.max(0,5-y)*.6;}return s});
 return Math.random()<.28?Math.floor(Math.random()*W):sc.indexOf(Math.max(...sc));
}
function spawnPair(){
 let a=Math.floor(Math.random()*4),b=Math.floor(Math.random()*4);
 let x=chooseColumn(a);
 pairs.push({id:++pairSeq,x,y:-1.8,a,b,hpA:2,hpB:2});
}
function pairBlocked(p,nextY){
 for(const part of [1,0]){
   let type=part===0?p.a:p.b;if(type==null)continue;
   let cy=nextY+part+.92;
   if(cy>=H)return true;
   let iy=Math.floor(cy);
   if(iy>=0&&board[iy]?.[p.x])return true;
   // Falling pairs also collide with earlier falling pairs.
   for(const q of pairs)if(q!==p){
     for(const qp of [0,1]){
       let qt=qp===0?q.a:q.b;if(qt==null)continue;
       if(q.x===p.x && Math.abs((nextY+part)-(q.y+qp))<.92)return true;
     }
   }
 }
 return false;
}
function updatePairs(dt){
 spawnClock+=dt;
 // Next pair may enter before the previous pair has landed.
 // Keep a modest vertical gap so the stream is readable.
 if(pairs.length===0 || (spawnClock>720 && pairs.every(p=>p.y>1.7))){
   spawnPair();spawnClock=0;
 }
 let landed=[];
 // Lower pieces update first.
 for(const p of [...pairs].sort((a,b)=>b.y-a.y)){
   let next=p.y+fallSpeed*dt;
   if(pairBlocked(p,next))landed.push(p);else p.y=next;
 }
 for(const p of landed)settlePair(p);
}
function settlePair(p){
 let x=p.x,y=topFree(x);
 let count=(p.a!=null?1:0)+(p.b!=null?1:0);
 if(y<count-1){gameOver=true;msg("GAME OVER");return}
 let hardChance=score>700?Math.min(.25,.06+score/9000):0;
 // Preserve visual order: b is the lower member, a the upper member.
 if(p.b!=null){board[y][x]=makeSlime(p.b,Math.random()<hardChance);y--}
 if(p.a!=null){board[y][x]=makeSlime(p.a,Math.random()<hardChance)}
 if(hero.grab?.kind==="pair"&&hero.grab.id===p.id)hero.grab=null;
 pairs=pairs.filter(q=>q!==p);resolve();
}
function resolve(){
 let groups=[],vis=Array.from({length:H},()=>Array(W).fill(false));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&!board[y][x].frozen&&!vis[y][x]){
  let q=[[x,y]],g=[],col=board[y][x].color;vis[y][x]=true;
  while(q.length){let [cx,cy]=q.pop();g.push([cx,cy]);for(const[dX,dY]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=cx+dX,ny=cy+dY;if(nx>=0&&nx<W&&ny>=0&&ny<H&&!vis[ny][nx]&&board[ny][nx]?.color===col&&!board[ny][nx]?.frozen){vis[ny][nx]=true;q.push([nx,ny])}}}
  if(g.length>=4)groups.push(g);
 }
 if(!groups.length){chain=0;return}
 chain++;chainPoints+=25*chain;document.querySelector("#chainPoints").textContent=chainPoints;if(chainPoints>=GOAL){cleared=true;msg("STAGE CLEAR!");document.querySelector("#message").classList.add("clear");}
 groups.flat().forEach(([x,y])=>{board[y][x]=null;score+=10*chain;special=Math.min(100,special+3*chain)});
 setTimeout(()=>{gravity();resolve()},160);
}
function gravity(){
 for(let x=0;x<W;x++){
  let bottom=H-1;
  while(bottom>=0){
   if(board[bottom][x]?.frozen){bottom--;continue}
   let top=bottom;while(top>=0&&!board[top][x]?.frozen)top--;
   let vals=[];for(let y=bottom;y>top;y--)if(board[y][x])vals.push(board[y][x]);
   let i=0;for(let y=bottom;y>top;y--)board[y][x]=i<vals.length?vals[i++]:null;
   bottom=top-1;
  }
 }
}
function solidAt(x,y){let ix=Math.floor(x),iy=Math.floor(y);return ix<0||ix>=W||iy>=H||(iy>=0&&board[iy][ix])}
function pairRect(p,part){
 if(!p)return null;
 if(part===0&&p.a==null)return null;if(part===1&&p.b==null)return null;
 return {l:p.x+.08,r:p.x+.92,t:p.y+part+.08,b:p.y+part+.92,p,part};
}
function heroHitsPair(nx,ny){
 let hl=nx-hero.w/2,hr=nx+hero.w/2,ht=ny-hero.h/2,hb=ny+hero.h/2;
 for(const p of pairs)for(const part of [0,1]){let r=pairRect(p,part);if(r&&hr>r.l&&hl<r.r&&hb>r.t&&ht<r.b)return {part,r,p}}
 return null;
}
function getPair(id){return pairs.find(p=>p.id===id)}
function nextHeroGrabColor(){
 // Fixed cycle: red -> yellow -> green -> blue -> red.
 const cycle=[COLORS[1],COLORS[3],COLORS[0],COLORS[2]];
 if(playerClass!=="hero"||!hero.grab)return;
 if(hero.grab.kind==="board"){
   let s=board[hero.grab.y]?.[hero.grab.x];if(!s)return;
   let i=cycle.indexOf(s.color);s.color=cycle[(i+1+cycle.length)%cycle.length];
   slimeHurtEffect(hero.grab.x+.5,hero.grab.y+.5,s.color);
 }else if(hero.grab.kind==="pair"){
   let p=getPair(hero.grab.id);if(!p)return;let part=hero.grab.part;
   let type=part===0?p.a:p.b;if(type==null)return;let c=COLORS[type],i=cycle.indexOf(c),next=cycle[(i+1+cycle.length)%cycle.length],ni=COLORS.indexOf(next);
   if(part===0)p.a=ni;else p.b=ni;
   slimeHurtEffect(p.x+.5,p.y+part+.5,next);
 }
 msg("色変化！");
}
function updateGrabColorCharge(dt){
 if(playerClass!=="hero"||!hero.grab||!keys.grab){hero.grabHold=0;hero.grabColorTick=0;return}
 hero.grabHold+=dt;
 if(hero.grabHold<520)return;
 hero.grabColorTick+=dt;
 if(hero.grabColorTick===dt||hero.grabColorTick>=480){nextHeroGrabColor();hero.grabColorTick=0}
}
function updateHero(dt){
 if(playerClass==="mage"&&hero.floating){
  hero.grab=null;hero.onGround=false;
  let ax=(keys.right?1:0)-(keys.left?1:0),ay=(keys.down?1:0)-(keys.up?1:0);
  if(ax)hero.face=ax;
  hero.vx=hero.vx*.94+ax*.00032*dt;hero.vy=hero.vy*.94+ay*.00032*dt;
  hero.vx=Math.max(-.0048,Math.min(.0048,hero.vx));hero.vy=Math.max(-.0048,Math.min(.0048,hero.vy));
  let nx=Math.max(.3,Math.min(W-.3,hero.x+hero.vx*dt)),ny=Math.max(.5,Math.min(H-.5,hero.y+hero.vy*dt));
  if(!solidAt(nx,hero.y)&&!heroHitsPair(nx,hero.y))hero.x=nx;else hero.vx=0;
  if(!solidAt(hero.x,ny)&&!heroHitsPair(hero.x,ny))hero.y=ny;else hero.vy=0;
  if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
  return;
 }
 if(hero.stun>0){hero.stun-=dt;return}
 if(hero.attackT>0)hero.attackT=Math.max(0,hero.attackT-dt);if(hero.kickT>0)hero.kickT=Math.max(0,hero.kickT-dt);if(hero.grabT>0)hero.grabT=Math.max(0,hero.grabT-dt);if(hero.squashT>0)hero.squashT=Math.max(0,hero.squashT-dt);if(hero.squeezeT>0)hero.squeezeT=Math.max(0,hero.squeezeT-dt);
 updateGrabColorCharge(dt);

 // Board grab remains a hanging/dragging action.
 if(hero.grab?.kind==="board"){
   let g=hero.grab;
   if(!board[g.y]?.[g.x])hero.grab=null;
   else{
     hero.vy=0;hero.y=g.y+.18;hero.x=g.x+.5+(g.side||-1)*.52;
     let dir=keys.left?-1:keys.right?1:0;
     if(dir&&!board[g.y-1]?.[g.x]){
       let nx=g.x+dir;
       // A settled slime may move sideways only if the destination has a floor/support
       // directly underneath. This prevents "sticking" to walls in mid-air.
       let supported = (g.y===H-1) || !!board[g.y+1]?.[nx];
       let destinationFree = nx>=0&&nx<W&&!board[g.y][nx];
       // Direction toward the slime = push. Push is allowed over an edge.
       // Direction away from the slime = pull, which still requires support.
       let pushing = (g.side<0&&dir>0)||(g.side>0&&dir<0);
       if(destinationFree&&(pushing||supported)){
         let moved=board[g.y][g.x];board[g.y][g.x]=null;board[g.y][nx]=moved;
         hero.grab={kind:"board",x:nx,y:g.y,side:g.side};
         hero.x=nx+.5+(g.side||-1)*.52;
         if(pushing&&!supported){hero.grab=null;gravity();resolve();msg("ポイッ！")}
       }
     }
     if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
     return;
   }
 }

 // Falling grab = elevator ride. The pair keeps falling naturally and the hero follows
 // the exact grabbed part, without changing the pair's orientation/order.
 if(hero.grab?.kind==="pair"){
   let gp=getPair(hero.grab.id);
   if(!gp || (hero.grab.part===0&&gp.a==null) || (hero.grab.part===1&&gp.b==null))hero.grab=null;
   else{
     let part=hero.grab.part;
     hero.vx=0;hero.vy=0;
     hero.x=gp.x + (hero.grab.side||-1)*.48 + .5;
     hero.y=gp.y+part+.52;
     if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
     return;
   }
 }

 hero.vx=0;if(keys.left){hero.vx=-.0042*dt;hero.face=-1}if(keys.right){hero.vx=.0042*dt;hero.face=1}
 if(hero.vx)hero.walk+=dt*.02;
 let nx=Math.max(.28,Math.min(W-.28,hero.x+hero.vx));
 // Falling slimes are solid horizontally too.
 if(!solidAt(nx,hero.y)&&!heroHitsPair(nx,hero.y))hero.x=nx;

 hero.vy+=.000027*dt;let ny=hero.y+hero.vy*dt;hero.onGround=false;
 let ph=heroHitsPair(hero.x,ny);
 if(ph){
   // If a falling slime hits the hero from above, don't teleport the hero onto it.
   // Knock him sideways, briefly stun him, and keep him below the falling object.
   let heroTop=hero.y-hero.h/2;
   if(hero.vy>=-.001 && (ph.r.b<=heroTop+.28 || (ph.p.y+ph.part)<hero.y-.28)){
     let leftBlocked=solidAt(hero.x-.62,hero.y),rightBlocked=solidAt(hero.x+.62,hero.y);
     hero.grab=null;hero.stun=0;hero.squashT=0;hero.squeezeT=320;
     if(leftBlocked&&rightBlocked){
       // Boxed on both sides: squeeze upward through the nearest open space.
       hero.squeezeDir=2;
       let targetY=hero.y;
       for(let sy=Math.floor(hero.y)-1;sy>=0;sy--){
         if(!solidAt(hero.x,sy)){targetY=sy+.45;break}
       }
       hero.y=targetY;hero.vy=-.002;
     }else{
       // Normal crush: ooze smoothly out to whichever side is open.
       let escape=!leftBlocked&&rightBlocked?-1:leftBlocked&&!rightBlocked?1:(hero.x<(ph.p.x+.5)?-1:1);
       hero.squeezeDir=escape;
       hero.x=Math.max(.3,Math.min(W-.3,hero.x+escape*.68));
       hero.vy=0;
     }
   }else if(hero.vy>0){hero.y=ph.r.t-hero.h/2;hero.vy=0;hero.onGround=true;if(playerClass==="monk")hero.jumps=0}
   else if(hero.vy<0){hero.y=ph.r.b+hero.h/2;hero.vy=.0015}
 }else if(hero.vy>=0&&solidAt(hero.x,ny+hero.h/2)){
   hero.vy=0;hero.y=Math.floor(ny+hero.h/2)-hero.h/2;hero.onGround=true;if(playerClass==="monk")hero.jumps=0;
 }else if(hero.vy<0&&solidAt(hero.x,ny-hero.h/2)){hero.vy=.002}else hero.y=ny;
 if(hero.y>H){hero.y=H-1.5;hero.vy=0}
 if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
}
function jump(){
 if(playerClass==="mage"){hero.floating=!hero.floating;hero.grab=null;if(hero.floating){hero.vx=0;hero.vy=0;msg("浮遊")}else{hero.vy=.001;msg("浮遊解除")}return}
 if(playerClass==="monk"){
   // Monk cannot jump from a grabbed slime. He gets a true double jump instead.
   if(hero.grab)return;
   if(hero.onGround){hero.jumps=0;hero.vy=-.0128;hero.jumps=1;hero.onGround=false;return}
   if(hero.jumps===1){hero.vy=-.0128;hero.jumps=2;hero.onGround=false;return}
   return;
 }
 if(hero.onGround||hero.grab){
   if(hero.grab?.kind==="pair"){
     let gp=getPair(hero.grab.id),side=hero.grab.side||hero.face||1;hero.grab=null;
     hero.x=Math.max(.3,Math.min(W-.3,hero.x+side*.42));hero.y-=.12;hero.vy=-.0115;hero.stun=0;return;
   }
   hero.grab=null;hero.vy=-.0115;
 }
}
function hitEffect(x,y,color="#fff"){
 effects.push({x,y,t:220,max:220,type:"hit",color});
}
function slimeHurtEffect(x,y,color){
 effects.push({x,y,t:280,max:280,type:"slime",color});
}
function attack(){
 let charged=hero.charge>=75;hero.charge=0;
 if(charged&&special>=100){doSpecial();return}
 hero.attackDir=keys.up?"up":keys.down?"down":hero.face>0?"right":"left";hero.attackT=150;

 if(playerClass==="mage"){
  let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}
  effects.push({x:hero.x,y:hero.y,t:360,max:360,type:"projectile",color:"#ff8a3d",dx,dy});
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dx*r,fy=hero.y+dy*r;
   for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(p.x+.5-fx)<.38&&Math.abs(p.y+part+.5-fy)<.38){if(part===0)p.a=null;else p.b=null;hitEffect(p.x+.5,p.y+part+.5,"#ff8a3d");return}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){hitEffect(tx+.5,ty+.5,"#ff8a3d");if(board[ty][tx].frozen){board[ty][tx].frozen=false;msg("解凍！");gravity();resolve();return}board[ty][tx]=null;gravity();resolve();return}
  }return;
 }
 if(playerClass==="monk"){
   // UP: uppercut. Counter/destroy a slime directly overhead, including falling slime.
   if(keys.up){
     let best=null;
     for(const p of pairs)for(const part of [0,1]){
       if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
       let px=p.x+.5,py=p.y+part+.5,dx=Math.abs(px-hero.x),dy=hero.y-py;
       if(dx<.55&&dy>0&&dy<1.65&&(!best||dy<best.dy))best={p,part,px,py,dy};
     }
     if(best){
       hitEffect(best.px,best.py);slimeHurtEffect(best.px,best.py,COLORS[best.part===0?best.p.a:best.p.b]);
       if(best.part===0)best.p.a=null;else best.p.b=null;score+=5;msg("アッパー！");
       return;
     }
     let tx=Math.floor(hero.x),ty=Math.floor(hero.y-1);
     if(ty>=0&&board[ty]?.[tx]){let c=board[ty][tx].color;board[ty][tx]=null;hitEffect(tx+.5,ty+.5);slimeHurtEffect(tx+.5,ty+.5,c);score+=5;gravity();resolve()}
     return;
   }
   // DOWN: smash the slime immediately below.
   if(keys.down){
     let tx=Math.floor(hero.x),ty=Math.floor(hero.y+1);
     if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){let c=board[ty][tx].color;board[ty][tx]=null;hitEffect(tx+.5,ty+.5);slimeHurtEffect(tx+.5,ty+.5,c);score+=5;gravity();resolve();msg("下段パンチ！")}
     return;
   }
   // LEFT/RIGHT: daruma punch. Only struck slime moves one cell; if blocked, destroy it.
   let dir=hero.face,ty=Math.floor(hero.y),tx=Math.floor(hero.x+dir*.82);
   let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.25&&(!best||d<best.d))best={p,part,d}}
   if(best){let nx=best.p.x+dir,blocked=nx<0||nx>=W||pairs.some(q=>q!==best.p&&q.x===nx&&Math.abs(q.y-best.p.y)<1.2);if(blocked){if(best.part===0)best.p.a=null;else best.p.b=null}else best.p.x=nx;hitEffect(best.p.x+.5,best.p.y+best.part+.5);return}
   if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){let nx=tx+dir,m=board[ty][tx];board[ty][tx]=null;if(nx>=0&&nx<W&&!board[ty][nx])board[ty][nx]=m;hitEffect(tx+.5,ty+.5);gravity();resolve()}return;
 }

 // Hero: normal slime one hit, hard slime remains tougher.
 let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}
 let reach=charged?2.05:1.15,hx=hero.x,hy=hero.y,power=charged?4:2;
 for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let px=p.x+.5,py=p.y+part+.5,along=(px-hx)*dx+(py-hy)*dy,perp=Math.abs((px-hx)*(-dy)+(py-hy)*dx);if(along>0&&along<=reach&&perp<.42){let key=part===0?"hpA":"hpB";p[key]-=power;hitEffect(px,py);slimeHurtEffect(px,py,COLORS[part===0?p.a:p.b]);if(p[key]<=0){if(part===0)p.a=null;else p.b=null;score+=5}return}}
 for(let r=.55;r<=reach;r+=.45){let tx=Math.floor(hx+dx*r),ty=Math.floor(hy+dy*r);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){let hc=board[ty][tx].color;board[ty][tx].hp-=power;hitEffect(tx+.5,ty+.5);slimeHurtEffect(tx+.5,ty+.5,hc);if(board[ty][tx].hp<=0){board[ty][tx]=null;score+=5;gravity();resolve()}return}}
}
function grab(){
 hero.grabT=220;hero.grabHold=0;hero.grabColorTick=0;
 if(playerClass==="mage"){
  hero.grabT=180;let dir=hero.face;effects.push({x:hero.x,y:hero.y,t:420,max:420,type:"wind",color:"#c8f2ff",dx:dir,dy:0});
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dir*r,fy=hero.y;
   for(const p of pairs){for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(p.x+.5-fx)<.4&&Math.abs(p.y+part+.5-fy)<.42){if(p.a!=null&&p.b!=null){[p.a,p.b]=[p.b,p.a];[p.hpA,p.hpB]=[p.hpB,p.hpA];msg("風転！")}return}}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=1&&ty<H&&board[ty][tx]){let t=board[ty][tx];board[ty][tx]=board[ty-1][tx];board[ty-1][tx]=t;msg("風転！");return}
  }return;
 }
 if(playerClass==="monk"){
   if(hero.carry){let tx=Math.max(0,Math.min(W-1,Math.floor(hero.x+hero.face*.7))),ty=Math.max(0,Math.min(H-1,Math.floor(hero.y)));if(!board[ty][tx]){board[ty][tx]=hero.carry;hero.carry=null;gravity();resolve()}return}
   let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.55&&(!best||d<best.d))best={p,part,d}}
   if(best){let type=best.part===0?best.p.a:best.p.b;if(best.part===0)best.p.a=null;else best.p.b=null;hero.carry=makeSlime(type);return}
   let cx=Math.floor(hero.x),cy=Math.floor(hero.y),cand=[[cx+hero.face,cy],[cx+hero.face,cy-1],[cx,cy-1],[cx,cy]];for(const [x,y] of cand)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){hero.carry=board[y][x];board[y][x]=null;gravity();resolve();return}return;
 }
 if(hero.grab){hero.grab=null;return}
 let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.55&&(!best||d<best.d))best={p,part,d}}
 if(best){let side=hero.x<best.p.x+.5?-1:1;hero.grab={kind:"pair",id:best.p.id,part:best.part,side};hero.vy=0;return}
 let cx=Math.floor(hero.x),cy=Math.floor(hero.y),candidates=[[cx+hero.face,cy],[cx+hero.face,cy-1],[cx+hero.face,cy+1],[cx+hero.face*2,cy],[cx,cy-1],[cx,cy],[cx-hero.face,cy],[cx,cy+1]];for(const [x,y] of candidates)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){let side=hero.x<x+.5?-1:1;hero.grab={kind:"board",x,y,side};hero.vx=0;hero.vy=0;hero.x=x+.5+side*.52;hero.y=y+.18;return}
}
function kick(){
 hero.kickT=180;let dir=hero.face,hy=Math.floor(hero.y);
 if(playerClass==="mage"){
  let dir=hero.face;effects.push({x:hero.x,y:hero.y,t:360,max:360,type:"projectile",color:"#9de9ff",dx:dir,dy:0});
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dir*r,fy=hero.y;
   for(const p of [...pairs])for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(p.x+.5-fx)<.38&&Math.abs(p.y+part+.5-fy)<.42){let type=part===0?p.a:p.b,ty=Math.max(0,Math.min(H-1,Math.floor(p.y+part+.5)));if(!board[ty][p.x]){let s=makeSlime(type);s.frozen=true;board[ty][p.x]=s;if(part===0)p.a=null;else p.b=null;msg("凍結！")}return}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){board[ty][tx].frozen=true;msg("凍結！");return}
  }return;
 }
 if(playerClass==="monk"){
   let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.2&&(!best||d<best.d))best={p,part,d}}
   if(best){let nx=best.p.x;if(nx+dir<0||nx+dir>=W){if(best.part===0)best.p.a=null;else best.p.b=null;return}while(nx+dir>=0&&nx+dir<W&&!board[Math.max(0,Math.floor(best.p.y+best.part))]?.[nx+dir])nx+=dir;if(nx===best.p.x){if(best.part===0)best.p.a=null;else best.p.b=null}else best.p.x=nx;return}
   let tx=Math.floor(hero.x+dir*.82),ty=hy;if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){let m=board[ty][tx],nx=tx;board[ty][tx]=null;if(nx+dir<0||nx+dir>=W||board[ty][nx+dir]){}else{while(nx+dir>=0&&nx+dir<W&&!board[ty][nx+dir])nx+=dir;board[ty][nx]=m}gravity();resolve()}return;
 }
 let target=null,best=9;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot((p.x+.5)-hero.x,(p.y+part+.5)-hero.y);if(d<1.18&&d<best){target=p;best=d}}if(target){let nx=target.x+dir;if(nx>=0&&nx<W)target.x=nx;return}
 let tx=Math.floor(hero.x+dir*.8),ty=hy;if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]&&!board[ty-1]?.[tx]){let nx=tx+dir;if(nx>=0&&nx<W&&!board[ty][nx]){board[ty][nx]=board[ty][tx];board[ty][tx]=null;gravity();resolve()}}
}
function doSpecial(){
 if(special<100)return;special=0;
 let target=playerClass==="monk"?COLORS[0]:playerClass==="mage"?COLORS[2]:COLORS[1];
 let name=playerClass==="monk"?"翠気功波！":playerClass==="mage"?"蒼氷解放！":"紅蓮斬！";
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]){if(board[y][x].color===target)board[y][x]=null;else if(playerClass==="mage")board[y][x].frozen=false}
 for(const p of pairs){if(p.a!=null&&COLORS[p.a]===target)p.a=null;if(p.b!=null&&COLORS[p.b]===target)p.b=null}
 effects.push({x:hero.x,y:hero.y,t:520,max:520,type:"wave",color:target});gravity();resolve();msg(name);
}
function msg(t){let m=document.querySelector("#message");m.textContent=t;if(!gameOver)setTimeout(()=>m.textContent="",850)}
function update(dt){effects.forEach(e=>e.t-=dt);effects=effects.filter(e=>e.t>0);if(gameOver||cleared||!playerClass)return;updatePairs(dt);updateHero(dt);fallSpeed=Math.min(.00145,.00075+score/9000000);document.querySelector("#score").textContent=score;document.querySelector("#chainPoints").textContent=chainPoints;document.querySelector("#specialText").textContent=Math.floor(special)+"%";document.querySelector("#specialBar").style.width=special+"%"}

function slime(x,y,s){if(y<-1)return;ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(x+.055,y+.055,.89,.89,.36);ctx.fill();ctx.fillStyle="#202438";ctx.beginPath();ctx.arc(x+.32,y+.42,.055,0,Math.PI*2);ctx.arc(x+.68,y+.42,.055,0,Math.PI*2);ctx.fill();if(s.hard){ctx.strokeStyle="#e7e8f0";ctx.lineWidth=.065;ctx.beginPath();ctx.roundRect(x+.13,y+.13,.74,.64,.25);ctx.stroke()}if(s.frozen){ctx.fillStyle="rgba(190,238,255,.5)";ctx.beginPath();ctx.roundRect(x+.04,y+.04,.92,.9,.25);ctx.fill();ctx.strokeStyle="#e4fbff";ctx.lineWidth=.04;ctx.stroke()}}
function drawHero(){
 let x=hero.x,y=hero.y,bob=hero.onGround&&hero.vx?Math.sin(hero.walk)*.035:0,f=hero.face;
 ctx.save();ctx.translate(x,y+bob);
 if(hero.squeezeT>0){let q=Math.sin((hero.squeezeT/320)*Math.PI);if(hero.squeezeDir===2){ctx.scale(1-.42*q,1+.55*q);ctx.translate(0,-.18*q)}else{ctx.scale(1+.42*q,1-.36*q);ctx.translate(-hero.squeezeDir*.12*q,.12*q)}}
 let step=hero.vx?Math.sin(hero.walk)*.12:0,kp=hero.kickT>0?Math.sin((1-hero.kickT/180)*Math.PI):0;

 if(playerClass==="monk"){
   // Original monk: green sleeveless gi, dark green pants, belt/wrist wraps, bare hands, headband.
   ctx.strokeStyle="#246944";ctx.lineWidth=.18;ctx.beginPath();
   if(hero.kickT>0){ctx.moveTo(-f*.07,.24);ctx.lineTo(-f*.12,.49);ctx.moveTo(f*.08,.24);ctx.lineTo(f*(.28+.4*kp),.28-.04*kp)}
   else{ctx.moveTo(-.11,.24);ctx.lineTo(-.15+step,.5);ctx.moveTo(.11,.24);ctx.lineTo(.15-step,.5)}ctx.stroke();
   ctx.strokeStyle="#4c3b30";ctx.lineWidth=.13;ctx.beginPath();
   if(hero.kickT>0){ctx.moveTo(-f*.12,.49);ctx.lineTo(-f*.23,.5);let fx=f*(.28+.4*kp),fy=.28-.04*kp;ctx.moveTo(fx,fy);ctx.lineTo(fx+f*.16,fy)}
   else{ctx.moveTo(-.15+step,.5);ctx.lineTo(-.25+step,.51);ctx.moveTo(.15-step,.5);ctx.lineTo(.25-step,.51)}ctx.stroke();
   ctx.fillStyle="#43a85e";ctx.beginPath();ctx.moveTo(-.27,-.2);ctx.lineTo(.27,-.2);ctx.lineTo(.22,.31);ctx.lineTo(-.22,.31);ctx.closePath();ctx.fill();
   ctx.fillStyle="#195d37";ctx.fillRect(-.25,.08,.5,.085);
   ctx.fillStyle="#e6c09d";ctx.beginPath();ctx.arc(0,-.39,.25,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#3a2923";ctx.beginPath();ctx.arc(-.02,-.49,.22,Math.PI,Math.PI*2);ctx.fill();
   ctx.fillStyle="#2f8f51";ctx.fillRect(-.25,-.48,.5,.055);ctx.beginPath();ctx.moveTo(-f*.2,-.46);ctx.lineTo(-f*.46,-.38);ctx.lineTo(-f*.22,-.35);ctx.fill();
   ctx.fillStyle="#222";ctx.fillRect(f*.08-.025,-.4,.05,.055);
   // Arms / directional punch
   let pdx=f,pdy=0;if(hero.attackDir==="up"){pdx=0;pdy=-1}else if(hero.attackDir==="down"){pdx=0;pdy=1}
   let punch=hero.attackT>0?Math.sin((1-hero.attackT/150)*Math.PI):0;
   ctx.strokeStyle="#e6c09d";ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(f*.18,-.08);ctx.lineTo(f*.31,-.01);ctx.stroke();
   ctx.beginPath();ctx.moveTo(-f*.18,-.08);ctx.lineTo(-f*.3,.03);ctx.stroke();
   if(hero.attackT>0){ctx.strokeStyle="#e6c09d";ctx.lineWidth=.15;ctx.beginPath();ctx.moveTo(0,-.05);ctx.lineTo(pdx*(.32+.42*punch),-.05+pdy*(.48+.3*punch));ctx.stroke()}
   if(hero.grabT>0&&!hero.grab&&!hero.carry){let gp=Math.sin((1-hero.grabT/220)*Math.PI),reach=.28+.28*gp;ctx.strokeStyle="#e6c09d";ctx.lineWidth=.115;ctx.beginPath();ctx.moveTo(f*.18,-.08);ctx.lineTo(f*reach,-.12);ctx.stroke();ctx.fillStyle="#e6c09d";ctx.beginPath();ctx.arc(f*(reach+.07),-.12,.085,0,Math.PI*2);ctx.fill()}
 }else if(playerClass==="mage"){
   ctx.fillStyle="#223a83";ctx.beginPath();ctx.moveTo(-.31,-.14);ctx.lineTo(.31,-.14);ctx.lineTo(.42,.5);ctx.lineTo(-.42,.5);ctx.closePath();ctx.fill();
   ctx.fillStyle="#315eb9";ctx.beginPath();ctx.moveTo(-.25,-.12);ctx.lineTo(.25,-.12);ctx.lineTo(.28,.43);ctx.lineTo(-.28,.43);ctx.closePath();ctx.fill();
   ctx.fillStyle="#76a9f2";ctx.beginPath();ctx.moveTo(-.27,-.15);ctx.lineTo(.05,-.15);ctx.lineTo(-.08,.1);ctx.lineTo(-.32,.04);ctx.closePath();ctx.fill();
   ctx.strokeStyle="#e7c65b";ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(-.3,.43);ctx.lineTo(.3,.43);ctx.moveTo(-.27,.08);ctx.lineTo(.27,.08);ctx.stroke();
   ctx.fillStyle="#efc7a5";ctx.beginPath();ctx.arc(0,-.38,.23,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#172d69";ctx.beginPath();ctx.moveTo(-.35,-.56);ctx.lineTo(.35,-.56);ctx.lineTo(.08,-1.03);ctx.lineTo(-.03,-.83);ctx.lineTo(-.13,-.98);ctx.closePath();ctx.fill();
   ctx.fillStyle="#315eb9";ctx.fillRect(-.41,-.59,.82,.085);ctx.strokeStyle="#e7c65b";ctx.lineWidth=.03;ctx.beginPath();ctx.moveTo(-.38,-.56);ctx.lineTo(.38,-.56);ctx.stroke();
   ctx.fillStyle="#6ed9ff";ctx.beginPath();ctx.arc(f*.02,-.1,.065,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e7c65b";ctx.lineWidth=.025;ctx.stroke();
   ctx.fillStyle="#222";ctx.fillRect(f*.07-.025,-.4,.05,.055);ctx.strokeStyle="#efc7a5";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(-.2,-.05);ctx.lineTo(-.39,.08);ctx.moveTo(.2,-.05);ctx.lineTo(.39,.08);ctx.stroke();
   ctx.fillStyle="#223a83";ctx.beginPath();ctx.arc(-.39,.08,.075,0,Math.PI*2);ctx.arc(.39,.08,.075,0,Math.PI*2);ctx.fill();
   if(hero.floating){ctx.strokeStyle="#9de9ff";ctx.lineWidth=.045;ctx.beginPath();ctx.ellipse(0,.55,.42,.11,0,0,Math.PI*2);ctx.stroke()}
 }else{
   // Hero: red-based outfit.
   ctx.fillStyle="#8f2638";ctx.beginPath();ctx.moveTo(-f*.12,-.18);ctx.lineTo(-f*.42,.38);ctx.lineTo(-f*.08,.3);ctx.closePath();ctx.fill();
   ctx.strokeStyle="#d8dce8";ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(-.11,.25);ctx.lineTo(-.14+step,.48);ctx.moveTo(.11,.25);ctx.lineTo(.14-step,.48);ctx.stroke();
   ctx.strokeStyle="#49382f";ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-.14+step,.48);ctx.lineTo(-.24+step,.49);ctx.moveTo(.14-step,.48);ctx.lineTo(.24-step,.49);ctx.stroke();
   ctx.fillStyle="#c83d4e";ctx.fillRect(-.23,-.18,.46,.48);ctx.fillStyle="#e5bd4c";ctx.fillRect(-.23,.11,.46,.07);
   ctx.fillStyle="#f0c6a2";ctx.beginPath();ctx.arc(0,-.38,.25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#5b3a2a";ctx.beginPath();ctx.arc(-.03,-.47,.23,Math.PI,Math.PI*2);ctx.lineTo(.2,-.4);ctx.lineTo(.08,-.5);ctx.lineTo(-.02,-.39);ctx.lineTo(-.12,-.51);ctx.lineTo(-.24,-.4);ctx.fill();ctx.fillStyle="#222";ctx.fillRect(f*.08-.025,-.4,.05,.055);
   if(hero.grabT>0&&!hero.grab){let gp=Math.sin((1-hero.grabT/220)*Math.PI),reach=.28+.28*gp;ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.115;ctx.beginPath();ctx.moveTo(f*.18,-.08);ctx.lineTo(f*reach,-.12);ctx.stroke();ctx.fillStyle="#f0c6a2";ctx.beginPath();ctx.arc(f*(reach+.07),-.12,.085,0,Math.PI*2);ctx.fill()}
   let dx=f,dy=0;if(hero.attackDir==="up"){dx=0;dy=-1}else if(hero.attackDir==="down"){dx=0;dy=1}else if(hero.attackDir==="left"){dx=-1;dy=0}else if(hero.attackDir==="right"){dx=1;dy=0}
   let thrust=hero.attackT>0?Math.sin((1-hero.attackT/150)*Math.PI)*.55:0,baseX=f*.25,baseY=-.02,handX=baseX+dx*thrust*.45,handY=baseY+dy*thrust*.45;
   ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(f*.15,-.06);ctx.lineTo(handX,handY);ctx.stroke();
   let bladeLen=.46+thrust*.62,tipx=handX+dx*bladeLen,tipy=handY+dy*bladeLen,px=-dy,py=dx,bladeHalf=.065,neckX=handX+dx*.08,neckY=handY+dy*.08;
   ctx.fillStyle="#edf2ff";ctx.beginPath();ctx.moveTo(neckX+px*bladeHalf,neckY+py*bladeHalf);ctx.lineTo(tipx,tipy);ctx.lineTo(neckX-px*bladeHalf,neckY-py*bladeHalf);ctx.closePath();ctx.fill();
   ctx.strokeStyle="#cda64b";ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(handX-dy*.12,handY+dx*.12);ctx.lineTo(handX+dy*.12,handY-dx*.12);ctx.stroke();
 }
 if(hero.grab){ctx.strokeStyle="#ffe071";ctx.lineWidth=.055;ctx.setLineDash([.08,.06]);ctx.beginPath();ctx.moveTo(0,-.15);if(hero.grab.kind==="pair"&&getPair(hero.grab.id)){let gp=getPair(hero.grab.id),py=gp.y+hero.grab.part+.5;ctx.lineTo(gp.x+.5-hero.x,py-hero.y)}else ctx.lineTo(0,-.78);ctx.stroke();ctx.setLineDash([])}
 if(hero.charge>0){ctx.strokeStyle=playerClass==="monk"?"#59dc76":"#ff5f78";ctx.lineWidth=.045;ctx.beginPath();ctx.arc(0,0,.57,0,Math.PI*2*hero.charge/100);ctx.stroke()}
 ctx.restore();
}
function drawEffects(){
 for(const e of effects){
   let p=1-e.t/e.max,alpha=e.t/e.max;
   ctx.save();ctx.globalAlpha=alpha;
   if(e.type==="hit"){
     ctx.strokeStyle="#fff6b0";ctx.lineWidth=.06;
     for(let i=0;i<6;i++){let a=i*Math.PI/3,r=.12+p*.32;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*.05,e.y+Math.sin(a)*.05);ctx.lineTo(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);ctx.stroke()}
   }else if(e.type==="projectile"){let q=1-e.t/e.max;ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x+(e.dx||0)*q*4,e.y+(e.dy||0)*q*4,.13,0,Math.PI*2);ctx.fill();
   }else if(e.type==="wind"){let q=1-e.t/e.max,xx=e.x+(e.dx||0)*q*4;ctx.strokeStyle=e.color;ctx.lineWidth=.05;ctx.beginPath();ctx.arc(xx,e.y,.12+.1*q,0,Math.PI*1.7);ctx.stroke();
   }else if(e.type==="wave"){
     ctx.strokeStyle=e.color;ctx.lineWidth=.13*(1-p)+.035;
     ctx.beginPath();ctx.arc(e.x,e.y,.3+p*4.7,0,Math.PI*2);ctx.stroke();
     ctx.globalAlpha=alpha*.35;ctx.beginPath();ctx.arc(e.x,e.y,.18+p*3.2,0,Math.PI*2);ctx.stroke();
   }else{
     ctx.strokeStyle=e.color;ctx.lineWidth=.055;ctx.beginPath();ctx.arc(e.x,e.y,.28+p*.18,0,Math.PI*2);ctx.stroke();
     ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(e.x-.12,e.y-.05,.045,0,Math.PI*2);ctx.arc(e.x+.12,e.y-.05,.045,0,Math.PI*2);ctx.fill();
   }
   ctx.restore();
 }
}
function draw(){
 ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.scale(S,S);
 ctx.strokeStyle="#34394f";ctx.lineWidth=.025;for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])slime(x,y,board[y][x]);
 for(const p of pairs){if(p.a!=null)slime(p.x,p.y,makeSlime(p.a));if(p.b!=null)slime(p.x,p.y+1,makeSlime(p.b))}
 drawEffects();drawHero();if(hero.carry)slime(hero.x+hero.face*.42-.5,hero.y-.95,hero.carry);ctx.restore();
}
function loop(t){let dt=Math.min(32,t-last);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
document.querySelectorAll(".classBtn").forEach(b=>b.addEventListener("click",()=>{playerClass=b.dataset.class;document.querySelector("#classSelect").style.display="none";document.querySelector("#className").textContent="職業: "+(playerClass==="hero"?"勇者（赤・紅蓮斬）":playerClass==="monk"?"モンク（緑・翠気功波）":"魔法使い（青・蒼氷解放）");}));
const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",z:"jump",x:"attack",c:"grab",k:"kick"};
addEventListener("keydown",e=>{let k=map[e.key];if(!k)return;e.preventDefault();keys[k]=true;if(k==="jump"&&!e.repeat)jump();if(k==="grab"&&!e.repeat)grab();if(k==="kick"&&!e.repeat)kick();});
addEventListener("keyup",e=>{let k=map[e.key];if(!k)return;e.preventDefault();if(k==="attack")attack();keys[k]=false;if(k==="grab"){hero.grabHold=0;hero.grabColorTick=0}});
document.querySelectorAll("button").forEach(b=>{let k=b.dataset.key;const down=e=>{e.preventDefault();keys[k]=true;b.classList.add("pressed");if(k==="jump")jump();if(k==="grab")grab();if(k==="kick")kick();};const up=e=>{e.preventDefault();if(k==="attack")attack();keys[k]=false;if(k==="grab"){hero.grabHold=0;hero.grabColorTick=0}b.classList.remove("pressed")};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up)});
