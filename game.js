const cv=document.querySelector("#game"),ctx=cv.getContext("2d");
const W=8,H=14,S=45,COLORS=["#59dc76","#ff5f78","#43aef5","#ffd85c"];
let board=Array.from({length:H},()=>Array(W).fill(null)),score=0,special=0,chain=0,chainPoints=0,GOAL=300,gameOver=false,cleared=false,playerClass=null;
let stage=1,bossMode=false,bossHp=30,bossMaxHp=30,bossHitT=0,bossSpawnT=0,bossFireT=1200,bossFireballs=[];

const hero={x:3.5,y:H-1.55,vx:0,vy:0,w:.52,h:.92,onGround:false,grab:null,stun:0,charge:0,face:1,walk:0,attackT:0,attackDir:"right",attackPower:1,kickT:0,grabT:0,squashT:0,squeezeT:0,squeezeDir:0,carry:null,jumps:0,grabHold:0,grabColorTick:0,floating:false};
let pairs=[],pairSeq=0,spawnClock=0,keys={},last=performance.now(),fallSpeed=.00075,effects=[];

function makeSlime(type,hard=false){return{color:type===-1?"#aeb4bf":COLORS[type],hp:hard?4:2,hard,frozen:false}}
function makeBossBlock(){return{color:"#687181",hp:999999,hard:true,frozen:false,bossBlock:true}}
function topFree(x){for(let y=0;y<H;y++)if(board[y][x])return y-1;return H-1}
function pairPos(p,part){return p.orient==="h"?{x:p.x+part,y:p.y}:{x:p.x,y:p.y+part}}
function seedBoard(){
 // A few ready-made same-colour pairs give the player something to work with immediately.
 const seeds=[[0,H-1,1],[1,H-1,1],[6,H-1,0],[7,H-1,0],[2,H-1,3],[2,H-2,3],[5,H-1,2],[5,H-2,2]];
 for(const [x,y,t] of seeds)board[y][x]=makeSlime(t);
}
seedBoard();
function placementScore(x,orient,a,b){
 let s=Math.random()*2.2, cells=orient==="h"?[[x,a],[x+1,b]]:[[x,a],[x,b]];
 for(const [cx,t] of cells){if(cx<0||cx>=W)return -999;let y=topFree(cx);if(y<1)s-=8;
  for(const [dx,dy] of [[-1,0],[1,0],[0,1]]){let q=board[y+dy]?.[cx+dx];if(q?.color===COLORS[t])s+=2.7;}
  // Beginner AI dislikes very tall columns, but not enough to be sensible every time.
  s-=Math.max(0,5-y)*.45;
 }
 if(a===b)s+=1.1;return s;
}
function choosePlan(a,b){
 let plans=[];for(const o of ["v","h"])for(let x=0;x<W-(o==="h"?1:0);x++)plans.push({x,o,s:placementScore(x,o,a,b)});
 plans.sort((u,v)=>v.s-u.s);
 // It tries to match colours, but often chooses its 2nd-5th idea: deliberately beginner-ish.
 let pick=Math.random()<.18?plans[Math.floor(Math.random()*plans.length)]:plans[Math.min(plans.length-1,Math.floor(Math.random()*5))];
 return pick;
}
function spawnPair(){
 let a=Math.floor(Math.random()*4),b=Math.floor(Math.random()*4),plan=choosePlan(a,b);
 pairs.push({id:++pairSeq,x:Math.floor(W/2)-1,y:-1.8,a,b,hpA:2,hpB:2,orient:"v",targetX:plan.x,targetOrient:plan.o,aiClock:0,rotated:false});
}
function pairBlocked(p,nextY,nextX=p.x,nextOrient=p.orient){
 for(const part of [0,1]){let type=part===0?p.a:p.b;if(type==null)continue;let pos=nextOrient==="h"?{x:nextX+part,y:nextY}:{x:nextX,y:nextY+part};
  if(pos.x<0||pos.x>=W||pos.y+.92>=H)return true;let iy=Math.floor(pos.y+.92);if(iy>=0&&board[iy]?.[pos.x])return true;
  for(const q of pairs)if(q!==p)for(const qp of [0,1]){let qt=qp===0?q.a:q.b;if(qt==null)continue;let z=pairPos(q,qp);if(z.x===pos.x&&Math.abs(pos.y-z.y)<.92)return true;}
 }
 return false;
}
function updatePairs(dt){
 spawnClock+=dt;if(pairs.length===0||(spawnClock>720&&pairs.every(p=>p.y>1.7))){spawnPair();spawnClock=0}
 let landed=[];
 for(const p of [...pairs].sort((a,b)=>b.y-a.y)){
  p.aiClock+=dt;
  if(p.windLock>0)p.windLock=Math.max(0,p.windLock-dt);
  // Visible "human" inputs. After a mage wind push, wait before touching that piece again.
  if(!p.windLock&&p.aiClock>300+Math.random()*180){p.aiClock=0;if(p.x!==p.targetX){let nx=p.x+Math.sign(p.targetX-p.x);if(!pairBlocked(p,p.y,nx,p.orient))p.x=nx}
   else if(!p.rotated&&p.targetOrient==="h"&&p.y>-.45){if(!pairBlocked(p,p.y,p.x,"h")){p.orient="h";p.rotated=true;msg(["プレイヤー: ここかなぁ…","プレイヤー: どこにしよう？","プレイヤー: 悩むなぁ…","プレイヤー: こっちかな？","プレイヤー: よし、ここ！"][Math.floor(Math.random()*5)])}}
  }
  let next=p.y+fallSpeed*dt;if(pairBlocked(p,next))landed.push(p);else p.y=next;
 }
 for(const p of landed)settlePair(p);
}
function settlePair(p){
 let hardChance=score>700?Math.min(.25,.06+score/9000):0;
 if(p.orient==="h"){
  for(const part of [0,1]){let type=part===0?p.a:p.b;if(type==null)continue;let x=p.x+part,y=topFree(x);if(y<0){showGameOver();return}board[y][x]=makeSlime(type,Math.random()<hardChance)}
 }else{
  let x=p.x,y=topFree(x),count=(p.a!=null?1:0)+(p.b!=null?1:0);if(y<count-1){showGameOver();return}
  if(p.b!=null){board[y][x]=makeSlime(p.b,Math.random()<hardChance);y--}if(p.a!=null)board[y][x]=makeSlime(p.a,Math.random()<hardChance);
 }
 if(hero.grab?.kind==="pair"&&hero.grab.id===p.id)hero.grab=null;pairs=pairs.filter(q=>q!==p);resolve();
}
function resolve(){
 let groups=[],vis=Array.from({length:H},()=>Array(W).fill(false));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&!board[y][x].frozen&&!vis[y][x]){
  let q=[[x,y]],g=[],col=board[y][x].color;vis[y][x]=true;
  while(q.length){let [cx,cy]=q.pop();g.push([cx,cy]);for(const[dX,dY]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=cx+dX,ny=cy+dY;if(nx>=0&&nx<W&&ny>=0&&ny<H&&!vis[ny][nx]&&board[ny][nx]?.color===col&&!board[ny][nx]?.frozen){vis[ny][nx]=true;q.push([nx,ny])}}}
  if(g.length>=4)groups.push(g);
 }
 if(!groups.length){chain=0;return}
 chain++;chainPoints+=25*chain;document.querySelector("#chainPoints").textContent=chainPoints;if(!bossMode&&chainPoints>=GOAL){finishStage();}
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
function solidAt(x,y){let ix=Math.floor(x),iy=Math.floor(y);return ix<0||ix>=W||iy>=H||bossPlatformAt(x,y)||(iy>=0&&board[iy][ix])}
function pairRect(p,part){
 if(!p)return null;
 if(part===0&&p.a==null)return null;if(part===1&&p.b==null)return null;
 let z=pairPos(p,part);return {l:z.x+.08,r:z.x+.92,t:z.y+.08,b:z.y+.92,p,part};
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
   slimeHurtEffect(pairPos(p,part).x+.5,pairPos(p,part).y+.5,next);
 }
 msg("色変化！");
}
function updateGrabColorCharge(dt){
 // v27: color cycling is tap-based, no hold delay.
}
function releaseHeroGrab(){
 if(playerClass!=="hero"||!hero.grab)return false;
 hero.grab=null;hero.grabHold=0;hero.grabColorTick=0;return true;
}
function destroyHeroGrabbed(){
 if(playerClass!=="hero"||!hero.grab)return false;
 if(hero.grab.kind==="board"){
  let x=hero.grab.x,y=hero.grab.y,s=board[y]?.[x];
  if(s){if(s.bossBlock){hitEffect(x+.5,y+.5,"#c8d0dc");hero.grab=null;return false}hitEffect(x+.5,y+.5,"#75e8ff");slimeHurtEffect(x+.5,y+.5,s.color);board[y][x]=null;hero.grab=null;gravity();resolve();return true}
 }
 if(hero.grab.kind==="pair"){
  let p=getPair(hero.grab.id);
  if(p){let part=hero.grab.part,z=pairPos(p,part),type=part===0?p.a:p.b;
   if(type!=null){hitEffect(z.x+.5,z.y+.5,"#75e8ff");if(part===0)p.a=null;else p.b=null;hero.grab=null;return true}
  }
 }
 hero.grab=null;return false;
}
function updateHero(dt){
 if(hero.stun>0){hero.stun-=dt;hero.vx*=.8;hero.vy*=.8;return}
 if(playerClass==="mage"){
  hero.grab=null;hero.onGround=false;
  let ax=(keys.right?1:0)-(keys.left?1:0),ay=(keys.down?1:0)-(keys.up?1:0);
  hero.vx=hero.vx*(ax?0.78:0.42)+ax*.00070*dt;
  hero.vy=hero.vy*(ay?0.78:0.42)+ay*.00070*dt;
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
function mageGustPush(){
 let dir=hero.face;
 effects.push({x:hero.x,y:hero.y,t:420,max:420,type:"wind",color:"#c8f2ff",dx:dir,dy:0});
 // Falling pair: push the whole falling piece one column.
 for(let r=.45;r<=4.5;r+=.25){
  let fx=hero.x+dir*r,fy=hero.y;
  for(const p of pairs)for(const part of [0,1]){
   if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
   if(Math.abs(pairPos(p,part).x+.5-fx)<.4&&Math.abs(pairPos(p,part).y+.5-fy)<.42){
    let nx=p.x+dir;
    if(nx>=0&&nx<W&&!pairBlocked(p,p.y,nx,p.orient)){
      p.x=nx;p.targetX=nx;p.windLock=700;p.aiClock=0;
      msg("風押し！");
    }else msg("動かせない！");
    return;
   }
  }
  // Settled stack: top slime -> 1, second from top -> top two, third or lower -> too heavy.
  let tx=Math.floor(fx),ty=Math.floor(fy);
  if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){
   let above=0;for(let yy=ty-1;yy>=0&&board[yy][tx];yy--)above++;
   if(above>=2){msg("重くて動かない！");return}
   let nx=tx+dir;if(nx<0||nx>=W){msg("動かせない！");return}
   let top=ty-above;
   for(let yy=top;yy<=ty;yy++)if(board[yy][nx]){msg("動かせない！");return}
   let moved=[];for(let yy=top;yy<=ty;yy++){moved.push([yy,board[yy][tx]]);board[yy][tx]=null}
   for(const [yy,v] of moved)board[yy][nx]=v;
   gravity();resolve();msg(above===0?"風押し！":"風押し・2個！");return;
  }
 }
}
function jump(){
 if(playerClass==="hero"&&hero.grab){releaseHeroGrab();hero.vy=-.0128;hero.onGround=false;return}
 if(playerClass==="mage"){mageGustPush();return}
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
     hero.x=Math.max(.3,Math.min(W-.3,hero.x+side*.42));hero.y-=.12;hero.vy=-.0128;hero.stun=0;return;
   }
   hero.grab=null;hero.vy=-.0128;
 }
}
function hitEffect(x,y,color="#fff"){
 effects.push({x,y,t:220,max:220,type:"hit",color});
}
function slimeHurtEffect(x,y,color){
 effects.push({x,y,t:280,max:280,type:"slime",color});
}
function attackHitsBoss(x,y,dx,dy,range,width=.55){
 if(!bossMode)return false;
 let rx=(W-.62)-x,ry=bossY-y,along=rx*dx+ry*dy,side=Math.abs(rx*(-dy)+ry*dx);
 return along>=-.2&&along<=range&&side<1.05+width;
}
function cancelBossFireAlong(x,y,dx,dy,range,label){
 if(!bossMode||!bossFireballs.length)return false;
 let best=null;
 for(const f of bossFireballs){
  let rx=f.x-x,ry=f.y-y,along=rx*dx+ry*dy,side=Math.abs(rx*(-dy)+ry*dx);
  if(along>=0&&along<=range&&side<.42&&(!best||along<best.along))best={f,along};
 }
 if(!best)return false;
 best.f.t=0;effects.push({x:best.f.x,y:best.f.y,t:260,max:260,type:"hit",color:"#fff0a0"});
 msg(label);return true;
}
function attack(){
 let charged=hero.charge>=75;hero.charge=0;
 if(playerClass==="hero"&&hero.grab){hero.attackDir=keys.up?"up":keys.down?"down":hero.face>0?"right":"left";hero.attackT=150;destroyHeroGrabbed();return}
 if(charged&&special>=100){doSpecial();return}
 hero.attackDir=keys.up?"up":keys.down?"down":hero.face>0?"right":"left";hero.attackT=150;
 if(playerClass==="hero"&&bossMode){let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}if(cancelBossFireAlong(hero.x,hero.y,dx,dy,1.55,"聖剣で相殺！"))return;if(attackHitsBoss(hero.x,hero.y,dx,dy,1.8,.45)){bossDamage(1,"剣撃！");return}}

 if(playerClass==="mage"){
  let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}
  effects.push({x:hero.x,y:hero.y,t:360,max:360,type:"projectile",color:"#ff8a3d",dx,dy});
  if(cancelBossFireAlong(hero.x,hero.y,dx,dy,4.5,"ファイアボールで相殺！"))return;
  if(attackHitsBoss(hero.x,hero.y,dx,dy,5.2,.38)){bossDamage(1,"ファイアボール！");return}
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dx*r,fy=hero.y+dy*r;
   for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(pairPos(p,part).x+.5-fx)<.38&&Math.abs(pairPos(p,part).y+.5-fy)<.38){if(part===0)p.a=null;else p.b=null;hitEffect(pairPos(p,part).x+.5,pairPos(p,part).y+.5,"#ff8a3d");return}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){hitEffect(tx+.5,ty+.5,"#ff8a3d");if(board[ty][tx].frozen){board[ty][tx].frozen=false;msg("解凍！");gravity();resolve();return}board[ty][tx]=null;gravity();resolve();return}
  }return;
 }
 if(playerClass==="monk"&&bossMode){let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}if(cancelBossFireAlong(hero.x,hero.y,dx,dy,1.25,"拳で相殺！"))return;if(attackHitsBoss(hero.x,hero.y,dx,dy,1.5,.45)){bossDamage(1,"拳撃！");return}}
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
   for(const p of pairs){for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(pairPos(p,part).x+.5-fx)<.4&&Math.abs(pairPos(p,part).y+.5-fy)<.42){if(p.a!=null&&p.b!=null){[p.a,p.b]=[p.b,p.a];[p.hpA,p.hpB]=[p.hpB,p.hpA];msg("風転！")}return}}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=1&&ty<H&&board[ty][tx]){let t=board[ty][tx];board[ty][tx]=board[ty-1][tx];board[ty-1][tx]=t;msg("風転！");return}
  }return;
 }
 if(playerClass==="monk"){
   if(hero.carry){let tx=Math.max(0,Math.min(W-1,Math.floor(hero.x+hero.face*.7))),ty=Math.max(0,Math.min(H-1,Math.floor(hero.y)));if(!board[ty][tx]){board[ty][tx]=hero.carry;hero.carry=null;gravity();resolve()}return}
   let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.55&&(!best||d<best.d))best={p,part,d}}
   if(best){let type=best.part===0?best.p.a:best.p.b;if(best.part===0)best.p.a=null;else best.p.b=null;hero.carry=makeSlime(type);return}
   let cx=Math.floor(hero.x),cy=Math.floor(hero.y),cand=[[cx+hero.face,cy],[cx+hero.face,cy-1],[cx,cy-1],[cx,cy]];for(const [x,y] of cand)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){hero.carry=board[y][x];board[y][x]=null;gravity();resolve();return}return;
 }
 if(hero.grab){nextHeroGrabColor();return}
 let cx=Math.floor(hero.x),cy=Math.floor(hero.y);
 // Down + grab prioritizes the slime directly under the hero.
 if(keys.down){
  let downY=Math.min(H-1,Math.floor(hero.y+.72)),downX=Math.max(0,Math.min(W-1,cx));
  if(board[downY]?.[downX]){hero.grab={kind:"board",x:downX,y:downY,side:0,down:true};hero.vx=0;hero.vy=0;msg("下を掴んだ！");return}
  let dbest=null;for(const p of pairs)for(const part of [0,1]){
   if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let z=pairPos(p,part),dx=Math.abs(z.x+.5-hero.x),dy=z.y+.5-hero.y;
   if(dx<.52&&dy>.15&&dy<1.15&&(!dbest||dy<dbest.dy))dbest={p,part,dy}
  }
  if(dbest){hero.grab={kind:"pair",id:dbest.p.id,part:dbest.part,side:0,down:true};hero.vy=0;msg("下を掴んだ！");return}
 }
 let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.55&&(!best||d<best.d))best={p,part,d}}
 if(best){let side=hero.x<best.p.x+.5?-1:1;hero.grab={kind:"pair",id:best.p.id,part:best.part,side};hero.vy=0;return}
 let candidates=[[cx+hero.face,cy],[cx+hero.face,cy-1],[cx+hero.face,cy+1],[cx+hero.face*2,cy],[cx,cy-1],[cx,cy],[cx-hero.face,cy],[cx,cy+1]];for(const [x,y] of candidates)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){let side=hero.x<x+.5?-1:1;hero.grab={kind:"board",x,y,side};hero.vx=0;hero.vy=0;hero.x=x+.5+side*.52;hero.y=y+.18;return}
}
function kick(){
 if(playerClass==="hero"&&hero.grab)releaseHeroGrab();
 if(playerClass==="hero"&&bossMode&&bossRectHit(hero.x+hero.face*1.0,hero.y,.9)){hero.kickT=180;bossDamage(1,"蹴り！");return}
 hero.kickT=180;let dir=hero.face,hy=Math.floor(hero.y);
 if(playerClass==="mage"){
  let dir=hero.face;effects.push({x:hero.x,y:hero.y,t:360,max:360,type:"projectile",color:"#9de9ff",dx:dir,dy:0});
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dir*r,fy=hero.y;if(bossRectHit(fx,fy,.55)){bossDamage(1,"アイスショット！");return}
   for(const p of [...pairs])for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(pairPos(p,part).x+.5-fx)<.38&&Math.abs(pairPos(p,part).y+.5-fy)<.42){let type=part===0?p.a:p.b,ty=Math.max(0,Math.min(H-1,Math.floor(p.y+part+.5)));if(!board[ty][p.x]){let s=makeSlime(type);s.frozen=true;board[ty][p.x]=s;if(part===0)p.a=null;else p.b=null;msg("凍結！")}return}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){board[ty][tx].frozen=true;msg("凍結！");return}
  }return;
 }
 if(playerClass==="monk"&&bossMode&&bossRectHit(hero.x+hero.face*1.0,hero.y,1.0)){hero.kickT=180;bossDamage(1,"モンクキック！");return}
 if(playerClass==="monk"){
   let best=null;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot(p.x+.5-hero.x,p.y+part+.5-hero.y);if(d<1.2&&(!best||d<best.d))best={p,part,d}}
   if(best){let nx=best.p.x;if(nx+dir<0||nx+dir>=W){if(best.part===0)best.p.a=null;else best.p.b=null;return}while(nx+dir>=0&&nx+dir<W&&!board[Math.max(0,Math.floor(best.p.y+best.part))]?.[nx+dir])nx+=dir;if(nx===best.p.x){if(best.part===0)best.p.a=null;else best.p.b=null}else best.p.x=nx;return}
   let tx=Math.floor(hero.x+dir*.82),ty=hy;if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){let m=board[ty][tx],nx=tx;board[ty][tx]=null;if(nx+dir<0||nx+dir>=W||board[ty][nx+dir]){}else{while(nx+dir>=0&&nx+dir<W&&!board[ty][nx+dir])nx+=dir;board[ty][nx]=m}gravity();resolve()}return;
 }
 let target=null,best=9;for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;let d=Math.hypot((p.x+.5)-hero.x,(p.y+part+.5)-hero.y);if(d<1.18&&d<best){target=p;best=d}}if(target){let nx=target.x+dir;if(nx>=0&&nx<W)target.x=nx;return}
 let tx=Math.floor(hero.x+dir*.8),ty=hy;
 if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){
  let above=0;for(let yy=ty-1;yy>=0&&board[yy][tx];yy--)above++;
  if(above>=2){msg("重くて蹴れない！");return}
  let nx=tx+dir;if(nx<0||nx>=W)return;
  let top=ty-above;for(let yy=top;yy<=ty;yy++)if(board[yy][nx])return;
  let moved=[];for(let yy=top;yy<=ty;yy++){moved.push([yy,board[yy][tx]]);board[yy][tx]=null}
  for(const [yy,v] of moved)board[yy][nx]=v;
  gravity();resolve();msg(above===0?"キック！":"2段キック！");
 }
}
function doSpecial(){
 if(special<100)return;special=0;
 let target=playerClass==="monk"?COLORS[0]:playerClass==="mage"?COLORS[2]:COLORS[1];
 let name=playerClass==="monk"?"翠気功波！":playerClass==="mage"?"蒼氷解放！":"紅蓮斬！";
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]){if(board[y][x].color===target)board[y][x]=null;else if(playerClass==="mage")board[y][x].frozen=false}
 for(const p of pairs){if(p.a!=null&&COLORS[p.a]===target)p.a=null;if(p.b!=null&&COLORS[p.b]===target)p.b=null}
 effects.push({x:hero.x,y:hero.y,t:520,max:520,type:"wave",color:target});gravity();resolve();msg(name);
}

function resetStageBoard(){
 board=Array.from({length:H},()=>Array(W).fill(null));pairs=[];effects=[];
 score=0;special=0;chain=0;chainPoints=0;cleared=false;gameOver=false;
 hero.x=W/2;hero.y=H-1.2;hero.vx=0;hero.vy=0;hero.grab=null;hero.carry=null;
 document.querySelector("#score").textContent=0;
 let cp=document.querySelector("#chainPoints");if(cp)cp.textContent=0;
 document.querySelector("#message").textContent="";
 document.querySelector("#message").classList.remove("clear");
}
function updateStageHud(){
 let s=document.querySelector("#stageText");if(s)s.textContent=bossMode?(bossTier===2?"BOSS 2":"BOSS"):stage;
 let bh=document.querySelector("#bossHud");if(bh)bh.style.display=bossMode?"inline":"none";
 let hp=document.querySelector("#bossHpText");if(hp)hp.textContent=Math.max(0,bossHp)+" / "+bossMaxHp;
}
function showGameOver(){
 if(gameOver)return;gameOver=true;
 let result=document.querySelector("#stageResult"),info=document.querySelector("#stageInfo");
 if(result)result.textContent="GAME OVER";
 if(info)info.textContent="同じステージから再挑戦できます。";
 let next=document.querySelector("#nextStageBtn"),cont=document.querySelector("#continueBtn");
 if(next)next.style.display="none";if(cont)cont.style.display="block";
 document.querySelector("#stageMenu").style.display="flex";
}
window.beginBossOnly=function(job){
 if(!job)return;
 selectedClass=job;playerClass=job;
 hero.floating=playerClass==="mage";
 setActionLabels();
 startBossStage();
 let cn=document.querySelector("#className");
 if(cn)cn.textContent="職業: "+(playerClass==="hero"?"勇者（赤・紅蓮斬）":playerClass==="monk"?"モンク（緑・翠気功波）":"魔法使い（青・蒼氷解放）");
};
function finishStage(){
 if(cleared)return;cleared=true;
 let nextBtn=document.querySelector("#nextStageBtn"),contBtn=document.querySelector("#continueBtn");
 if(nextBtn)nextBtn.style.display="block";if(contBtn)contBtn.style.display="none";
 let result=document.querySelector("#stageResult"),info=document.querySelector("#stageInfo");
 if(result)result.textContent=bossMode?"BOSS CLEAR!":"STAGE CLEAR!";
 if(info)info.textContent=bossMode?"ボス撃破！ 次は通常ステージ1から再開します。":(stage>=3?"次はボス戦です。":"次は落下が少し激しくなります。");
 document.querySelector("#stageMenu").style.display="flex";
}
function startNormalStage(n){
 stage=n;bossMode=false;GOAL=300+(stage-1)*100;resetStageBoard();
 // Start with a little material already on the field.
 seedOpeningBoard();
 spawnClock=0;if(typeof spawnPair==="function")spawnPair();
 updateStageHud();
}
function bossPlatformAt(x,y){
 if(!bossMode||bossTier!==1)return false;
 let ix=Math.floor(x),iy=Math.floor(y),c=W-1;
 return (ix===c&&iy>=H-3&&iy<H)||(ix===c-1&&iy>=H-2&&iy<H)||(ix===c-2&&iy===H-1);
}
function seedBossPlatforms(){
 let cells=[[1,H-1],[2,H-1],[4,H-1],[6,H-1],[6,H-2]];
 for(const [x,y] of cells)if(x>=0&&x<W&&y>=0&&y<H&&!board[y][x])board[y][x]=makeSlime(-1);
}
function startBossStage(tier=1){
 try{localStorage.setItem("osekkaiBossUnlocked","1")}catch(e){}
 let bb=document.querySelector("#bossOnlyBtn");if(bb)bb.style.display="block";
 bossMode=true;bossTier=tier;bossMaxHp=tier===2?48:30;bossHp=bossMaxHp;
 bossSpawnT=0;bossFireT=tier===2?650:900;bossFireballs=[];bossDir=1;
 resetStageBoard();
 hero.floating=playerClass==="mage";
 if(playerClass==="mage"){hero.y=H-3.0;hero.vy=0}else{hero.y=H-1.2;hero.vy=0}
 bossY=tier===2?H*.48:H-3.95;
 seedBossPlatforms();
 updateStageHud();msg(tier===2?"STRONG BOSS!":"BOSS!");
}
function bossDamage(amount,label="HIT!"){
 if(!bossMode||bossHp<=0)return false;
 bossHp=Math.max(0,bossHp-amount);bossHitT=180;updateStageHud();msg(label);
 if(bossHp<=0)finishStage();return true;
}
function bossRectHit(x,y,range=.75){
 return bossMode && Math.abs(x-(W-.62))<range && Math.abs(y-bossY)<1.35;
}
function spawnBossSingle(){
 let neutral=bossTier===2||Math.random()<.22;
 let type=neutral?-1:Math.floor(Math.random()*COLORS.length);
 let p={id:(Date.now()+Math.random()),x:Math.floor(Math.random()*Math.max(1,W-2)),y:-1,a:type,b:null,hpA:neutral?3:2,hpB:0,rot:0,targetX:0,targetRot:0,aiT:999};
 p.targetX=p.x;pairs.push(p);
}
function updateBoss(dt){
 if(!bossMode)return;
 if(bossTier===2){
  bossY+=bossDir*.00115*dt;
  if(bossY>H-2.2){bossY=H-2.2;bossDir=-1}
  if(bossY<2.0){bossY=2.0;bossDir=1}
 }
 bossSpawnT-=dt;if(bossSpawnT<=0){spawnBossSingle();bossSpawnT=bossTier===2?1050+Math.random()*380:850+Math.random()*300}
 if(bossHitT>0)bossHitT-=dt;
 bossFireT-=dt;
 if(bossFireT<=0){
  bossFireT=bossTier===2?1900+Math.random()*900:2400+Math.random()*1400;
  let bx=W-.9,by=bossY-.3,dx=hero.x-bx,dy=hero.y-by,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  if(bossTier===2){
   let ang=.20,ca=Math.cos(ang),sa=Math.sin(ang);
   for(const s of [-1,1]){let vx=ux*ca-uy*sa*s,vy=ux*sa*s+uy*ca;bossFireballs.push({x:bx,y:by,vx:vx*.00315,vy:vy*.00315,t:3600})}
   msg("強ボス: ダブルファイア！");
  }else{bossFireballs.push({x:bx,y:by,vx:ux*.0030,vy:uy*.0030,t:3200});msg("ボス: ファイア！")}
 }
 for(const f of bossFireballs){
  f.x+=f.vx*dt;f.y+=f.vy*dt;f.t-=dt;
  let blocked=false,tx=Math.floor(f.x),ty=Math.floor(f.y);
  if(bossPlatformAt(f.x,f.y)||(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]))blocked=true;
  if(!blocked){
   for(const p of pairs){
    for(const part of [0,1]){
     let val=part===0?p.a:p.b;if(val==null)continue;
     let z=pairPos(p,part);
     if(Math.abs((z.x+.5)-f.x)<.42&&Math.abs((z.y+.5)-f.y)<.42){blocked=true;break}
    }
    if(blocked)break;
   }
  }
  if(blocked){f.t=0;effects.push({x:f.x,y:f.y,t:180,max:180,type:"hit",color:"#ff8a3d"});continue}
  if(Math.abs(f.x-hero.x)<.42&&Math.abs(f.y-hero.y)<.55&&hero.stun<=0){
   hero.stun=1000;f.t=0;msg("熱っ！ 1秒動けない！");
  }
 }
 bossFireballs=bossFireballs.filter(f=>f.t>0&&f.x>-.5&&f.x<W+.5&&f.y>-.5&&f.y<H+.5);
 // Any falling/propelled slime touching boss damages it and disappears.
 for(const p of [...pairs]){
  for(const part of [0,1]){
   let val=part===0?p.a:p.b;if(val==null)continue;
   let px=p.x+.5,py=p.y+part+.5;
   if(bossRectHit(px,py,.8)){bossDamage(val===-1?2:1,"スライム直撃！");if(part===0)p.a=null;else p.b=null}
  }
 }
}
function seedOpeningBoard(){
 if(!board||!board.length||typeof makeSlime!=="function")return;
 let usable=Math.min(4,COLORS.length), xs=[];
 for(let i=0;i<usable;i++)xs.push(Math.max(0,Math.min(W-1,1+i*2)));
 for(let i=0;i<xs.length;i++){
  let x=xs[i],y=H-1;
  if(board[y]&&!board[y][x])board[y][x]=makeSlime(i);
  if(y-1>=0&&board[y-1]&&!board[y-1][x])board[y-1][x]=makeSlime(i);
 }
}
function msg(t){let m=document.querySelector("#message");m.textContent=t;if(!gameOver)setTimeout(()=>m.textContent="",850)}
function update(dt){
 effects.forEach(e=>e.t-=dt);effects=effects.filter(e=>e.t>0);
 if(gameOver||cleared||!playerClass)return;
 updateBoss(dt);
 updatePairs(dt);updateHero(dt);
 fallSpeed=Math.min(.00145,.00075+score/9000000);
 document.querySelector("#score").textContent=score;
 document.querySelector("#chainPoints").textContent=chainPoints;
 document.querySelector("#specialText").textContent=Math.floor(special)+"%";
 document.querySelector("#specialBar").style.width=special+"%";
}

function slime(x,y,s){if(y<-1)return;ctx.fillStyle=s.color||"#aeb4bf";ctx.beginPath();ctx.roundRect(x+.055,y+.055,.89,.89,.36);ctx.fill();ctx.fillStyle="#202438";ctx.beginPath();ctx.arc(x+.32,y+.42,.055,0,Math.PI*2);ctx.arc(x+.68,y+.42,.055,0,Math.PI*2);ctx.fill();if(s.hard){ctx.strokeStyle="#e7e8f0";ctx.lineWidth=.065;ctx.beginPath();ctx.roundRect(x+.13,y+.13,.74,.64,.25);ctx.stroke()}if(s.frozen){ctx.fillStyle="rgba(190,238,255,.5)";ctx.beginPath();ctx.roundRect(x+.04,y+.04,.92,.9,.25);ctx.fill();ctx.strokeStyle="#e4fbff";ctx.lineWidth=.04;ctx.stroke()}}

function drawBoss(){
 if(!bossMode)return;
 let x=W-.62,y=bossY;
 // Permanent three-step stone pedestal: terrain, not slime data.
 if(bossTier===1){ctx.save();for(let step=0;step<3;step++){let bx=W-1-step,h=3-step;for(let yy=H-h;yy<H;yy++){ctx.fillStyle="#596372";ctx.fillRect(bx+.04,yy+.04,.92,.92);ctx.fillStyle="#7c8796";ctx.fillRect(bx+.09,yy+.09,.82,.16);ctx.strokeStyle="#3f4753";ctx.lineWidth=.035;ctx.strokeRect(bx+.04,yy+.04,.92,.92);}}ctx.restore();}
 ctx.save();ctx.translate(x,y);
 let q=bossHitT>0?Math.sin(bossHitT*.08)*.06:0;ctx.scale(1+q,1-q);
 // cloak/body: about two grid cells tall
 ctx.fillStyle="#39234f";ctx.beginPath();ctx.moveTo(-.46,.72);ctx.lineTo(-.5,-.25);ctx.quadraticCurveTo(-.42,-.72,0,-.82);ctx.quadraticCurveTo(.42,-.72,.5,-.25);ctx.lineTo(.46,.72);ctx.closePath();ctx.fill();
 ctx.fillStyle="#6f3b86";ctx.beginPath();ctx.moveTo(-.36,.62);ctx.lineTo(-.34,-.15);ctx.lineTo(0,.05);ctx.lineTo(.34,-.15);ctx.lineTo(.36,.62);ctx.closePath();ctx.fill();
 // shoulder armor
 ctx.fillStyle="#b4873c";ctx.beginPath();ctx.ellipse(-.38,-.17,.22,.14,-.2,0,Math.PI*2);ctx.ellipse(.38,-.17,.22,.14,.2,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#e1b951";ctx.beginPath();ctx.arc(-.38,-.18,.075,0,Math.PI*2);ctx.arc(.38,-.18,.075,0,Math.PI*2);ctx.fill();
 // face
 ctx.fillStyle="#9d66b4";ctx.beginPath();ctx.arc(0,-.48,.34,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#4d285f";ctx.beginPath();ctx.moveTo(-.29,-.58);ctx.lineTo(-.46,-.8);ctx.lineTo(-.2,-.7);ctx.moveTo(.29,-.58);ctx.lineTo(.46,-.8);ctx.lineTo(.2,-.7);ctx.fill();
 ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(-.12,-.51,.075,0,Math.PI*2);ctx.arc(.12,-.51,.075,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#df4b49";ctx.beginPath();ctx.arc(-.105,-.5,.035,0,Math.PI*2);ctx.arc(.105,-.5,.035,0,Math.PI*2);ctx.fill();
 // ornate crown + central gem
 ctx.fillStyle="#e5bd4c";ctx.beginPath();ctx.moveTo(-.31,-.72);ctx.lineTo(-.24,-1.02);ctx.lineTo(-.08,-.84);ctx.lineTo(0,-1.08);ctx.lineTo(.1,-.84);ctx.lineTo(.27,-1.02);ctx.lineTo(.32,-.72);ctx.closePath();ctx.fill();
 ctx.fillStyle="#65d8f3";ctx.beginPath();ctx.moveTo(0,-.95);ctx.lineTo(.07,-.86);ctx.lineTo(0,-.77);ctx.lineTo(-.07,-.86);ctx.closePath();ctx.fill();
 // chest jewel and gold trim
 ctx.strokeStyle="#d9ad4a";ctx.lineWidth=.04;ctx.beginPath();ctx.moveTo(-.27,.08);ctx.lineTo(0,.25);ctx.lineTo(.27,.08);ctx.stroke();
 ctx.fillStyle="#d84c61";ctx.beginPath();ctx.moveTo(0,.12);ctx.lineTo(.09,.23);ctx.lineTo(0,.35);ctx.lineTo(-.09,.23);ctx.closePath();ctx.fill();
 ctx.restore();
 for(const f of bossFireballs){
  ctx.save();ctx.translate(f.x,f.y);ctx.fillStyle="#ff6a2a";ctx.beginPath();ctx.arc(0,0,.16,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#ffd35a";ctx.beginPath();ctx.arc(-.04,-.02,.08,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}
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
   // Monk: layered emerald gi with cream lapels, sash, shoulder guard and prayer beads.
   ctx.fillStyle="#237b4b";ctx.beginPath();ctx.moveTo(-.29,-.2);ctx.lineTo(.29,-.2);ctx.lineTo(.23,.31);ctx.lineTo(-.23,.31);ctx.closePath();ctx.fill();
   ctx.fillStyle="#3eae68";ctx.beginPath();ctx.moveTo(-.25,-.18);ctx.lineTo(.03,.02);ctx.lineTo(-.06,.25);ctx.lineTo(-.25,.16);ctx.closePath();ctx.fill();
   ctx.fillStyle="#efe2b8";ctx.beginPath();ctx.moveTo(-.13,-.2);ctx.lineTo(.04,.01);ctx.lineTo(.15,-.2);ctx.lineTo(.23,-.17);ctx.lineTo(.05,.11);ctx.lineTo(-.22,-.14);ctx.closePath();ctx.fill();
   ctx.fillStyle="#174e35";ctx.fillRect(-.26,.08,.52,.09);
   ctx.fillStyle="#d9aa42";ctx.fillRect(-.26,.115,.52,.035);
   ctx.fillStyle="#e6c09d";ctx.beginPath();ctx.arc(0,-.39,.25,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#3a2923";ctx.beginPath();ctx.arc(-.02,-.49,.22,Math.PI,Math.PI*2);ctx.fill();
   ctx.fillStyle="#d9aa42";ctx.fillRect(-.255,-.49,.51,.06);ctx.beginPath();ctx.moveTo(-f*.2,-.46);ctx.lineTo(-f*.46,-.36);ctx.lineTo(-f*.22,-.34);ctx.fill();
   ctx.fillStyle="#174e35";ctx.beginPath();ctx.arc(-f*.23,-.08,.105,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#a96a37";for(let bi=0;bi<4;bi++){ctx.beginPath();ctx.arc(-.13+bi*.085,-.02,.035,0,Math.PI*2);ctx.fill()}
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
   // Brighter wizard hat: cobalt body, wide brim, gold band, crescent and feather.
   ctx.fillStyle="#315fc2";ctx.beginPath();ctx.moveTo(-.35,-.56);ctx.lineTo(.35,-.56);ctx.lineTo(.13,-1.04);ctx.lineTo(.02,-.86);ctx.lineTo(-.13,-1.00);ctx.closePath();ctx.fill();
   ctx.fillStyle="#274b9d";ctx.beginPath();ctx.ellipse(0,-.555,.43,.095,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#e7c65b";ctx.fillRect(-.32,-.65,.62,.065);
   ctx.fillStyle="#fff0a5";ctx.beginPath();ctx.arc(.09,-.82,.09,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#315fc2";ctx.beginPath();ctx.arc(.13,-.85,.075,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#b8eaff";ctx.lineWidth=.04;ctx.beginPath();ctx.moveTo(-.17,-.67);ctx.quadraticCurveTo(-.38,-.91,-.25,-1.06);ctx.stroke();
   ctx.fillStyle="#9ee9ff";ctx.beginPath();ctx.ellipse(-.28,-.92,.055,.17,-.55,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#fff2a6";ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(-.36,-.56);ctx.lineTo(.36,-.56);ctx.stroke();
   ctx.fillStyle="#6ed9ff";ctx.beginPath();ctx.arc(f*.02,-.1,.065,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e7c65b";ctx.lineWidth=.025;ctx.stroke();
   ctx.fillStyle="#222";ctx.fillRect(f*.07-.025,-.4,.05,.055);ctx.strokeStyle="#efc7a5";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(-.2,-.05);ctx.lineTo(-.39,.08);ctx.moveTo(.2,-.05);ctx.lineTo(.39,.08);ctx.stroke();
   ctx.fillStyle="#223a83";ctx.beginPath();ctx.arc(-.39,.08,.075,0,Math.PI*2);ctx.arc(.39,.08,.075,0,Math.PI*2);ctx.fill();
   // No platform: the robe and feet bob at different heights so the mage reads as hovering, not standing.
   let hover=Math.sin(performance.now()/180)*.035;
   ctx.strokeStyle="#172d69";ctx.lineWidth=.105;ctx.beginPath();ctx.moveTo(-.11,.39);ctx.lineTo(-.16,.53+hover);ctx.moveTo(.11,.39);ctx.lineTo(.16,.49-hover*.55);ctx.stroke();
   ctx.strokeStyle="#6faeea";ctx.lineWidth=.025;ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(-.15,.59+hover,.10,Math.PI*.1,Math.PI*.9);ctx.stroke();ctx.beginPath();ctx.arc(.16,.56-hover*.55,.08,Math.PI*.1,Math.PI*.9);ctx.stroke();ctx.globalAlpha=1
 }else{
   // Hero: red-based outfit.
   ctx.fillStyle="#8f2638";ctx.beginPath();ctx.moveTo(-f*.12,-.18);ctx.lineTo(-f*.42,.38);ctx.lineTo(-f*.08,.3);ctx.closePath();ctx.fill();
   ctx.strokeStyle="#d8dce8";ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(-.11,.25);ctx.lineTo(-.14+step,.48);ctx.moveTo(.11,.25);ctx.lineTo(.14-step,.48);ctx.stroke();
   ctx.strokeStyle="#49382f";ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-.14+step,.48);ctx.lineTo(-.24+step,.49);ctx.moveTo(.14-step,.48);ctx.lineTo(.24-step,.49);ctx.stroke();
   ctx.fillStyle="#a8293f";ctx.beginPath();ctx.moveTo(-.24,-.18);ctx.lineTo(.24,-.18);ctx.lineTo(.21,.3);ctx.lineTo(-.21,.3);ctx.closePath();ctx.fill();
   ctx.fillStyle="#d94a58";ctx.beginPath();ctx.moveTo(-.2,-.17);ctx.lineTo(.03,.02);ctx.lineTo(.2,-.17);ctx.lineTo(.2,.04);ctx.lineTo(.03,.15);ctx.lineTo(-.2,.02);ctx.closePath();ctx.fill();
   ctx.fillStyle="#f0dfb2";ctx.beginPath();ctx.moveTo(-.13,-.18);ctx.lineTo(.02,-.01);ctx.lineTo(.13,-.18);ctx.lineTo(.19,-.14);ctx.lineTo(.03,.09);ctx.lineTo(-.19,-.13);ctx.closePath();ctx.fill();
   ctx.fillStyle="#e5bd4c";ctx.fillRect(-.23,.105,.46,.075);
   ctx.fillStyle="#6f2136";ctx.beginPath();ctx.arc(-f*.22,-.07,.105,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e5bd4c";ctx.lineWidth=.025;ctx.stroke();
   ctx.fillStyle="#f0c6a2";ctx.beginPath();ctx.arc(0,-.38,.25,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#5b3a2a";ctx.beginPath();ctx.arc(-.03,-.47,.23,Math.PI,Math.PI*2);ctx.lineTo(.2,-.4);ctx.lineTo(.08,-.5);ctx.lineTo(-.02,-.39);ctx.lineTo(-.12,-.51);ctx.lineTo(-.24,-.4);ctx.fill();
   // Forehead circlet: sits across the hairline instead of floating above the head.
   ctx.strokeStyle="#e8c75b";ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(-.19,-.515);ctx.quadraticCurveTo(0,-.555,.19,-.515);ctx.stroke();
   ctx.fillStyle="#e8c75b";ctx.beginPath();ctx.moveTo(-.075,-.55);ctx.lineTo(0,-.615);ctx.lineTo(.075,-.55);ctx.lineTo(.052,-.49);ctx.lineTo(-.052,-.49);ctx.closePath();ctx.fill();
   ctx.fillStyle="#59d8ef";ctx.beginPath();ctx.moveTo(0,-.585);ctx.lineTo(.034,-.548);ctx.lineTo(0,-.508);ctx.lineTo(-.034,-.548);ctx.closePath();ctx.fill();
   ctx.fillStyle="#222";ctx.fillRect(f*.08-.025,-.4,.05,.055);
   if(hero.grabT>0&&!hero.grab){let gp=Math.sin((1-hero.grabT/220)*Math.PI),reach=.28+.28*gp;ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.115;ctx.beginPath();ctx.moveTo(f*.18,-.08);ctx.lineTo(f*reach,-.12);ctx.stroke();ctx.fillStyle="#f0c6a2";ctx.beginPath();ctx.arc(f*(reach+.07),-.12,.085,0,Math.PI*2);ctx.fill()}
   let dx=f,dy=0;if(hero.attackDir==="up"){dx=0;dy=-1}else if(hero.attackDir==="down"){dx=0;dy=1}else if(hero.attackDir==="left"){dx=-1;dy=0}else if(hero.attackDir==="right"){dx=1;dy=0}
   let thrust=hero.attackT>0?Math.sin((1-hero.attackT/150)*Math.PI)*.55:0,baseX=f*.25,baseY=-.02,handX=baseX+dx*thrust*.45,handY=baseY+dy*thrust*.45;
   ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(f*.15,-.06);ctx.lineTo(handX,handY);ctx.stroke();
   if(hero.attackT>0){
    let bladeLen=.46+thrust*.62,tipx=handX+dx*bladeLen,tipy=handY+dy*bladeLen,px=-dy,py=dx,bladeHalf=.07,neckX=handX+dx*.08,neckY=handY+dy*.08;
    ctx.fillStyle="#bff7ff";ctx.beginPath();ctx.moveTo(neckX+px*bladeHalf,neckY+py*bladeHalf);ctx.lineTo(tipx,tipy);ctx.lineTo(neckX-px*bladeHalf,neckY-py*bladeHalf);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#55cde7";ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(neckX,neckY);ctx.lineTo(tipx-dx*.05,tipy-dy*.05);ctx.stroke();
    ctx.strokeStyle="#e6bf4f";ctx.lineWidth=.075;ctx.beginPath();ctx.moveTo(handX-dy*.12,handY+dx*.12);ctx.lineTo(handX+dy*.12,handY-dx*.12);ctx.stroke();
   }
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
 let bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#526d94");bg.addColorStop(.55,"#405a7d");bg.addColorStop(1,"#30445f");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 // soft clouds / magical haze
 ctx.fillStyle="rgba(225,240,255,.055)";
 for(let i=0;i<5;i++){let cx=1.1+i*1.75,cy=1.4+(i%2)*2.8;ctx.beginPath();ctx.arc(cx,cy,.75,0,Math.PI*2);ctx.arc(cx+.55,cy+.12,.55,0,Math.PI*2);ctx.fill()}
 // distant floor glow
 ctx.fillStyle="rgba(170,205,235,.06)";ctx.fillRect(0,H-2.2,W,2.2);
 ctx.strokeStyle="#34394f";ctx.lineWidth=.025;for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])slime(x,y,board[y][x]);
 for(const p of pairs){if(p.a!=null){let z=pairPos(p,0);slime(z.x,z.y,makeSlime(p.a))}if(p.b!=null){let z=pairPos(p,1);slime(z.x,z.y,makeSlime(p.b))}}
 drawBoss();drawEffects();drawHero();if(hero.carry)slime(hero.x+hero.face*.42-.5,hero.y-.95,hero.carry);ctx.restore();
}
function loop(t){let dt=Math.min(32,t-last);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
const CLASS_HELP={
 hero:"勇者｜攻撃：剣（上下左右）／跳：ジャンプ／掴：スライム操作・長押しで色変化／蹴：1マス移動／チャージ：赤全消去",
 monk:"モンク｜攻撃：パンチ（横=ダルマ落とし・上=アッパー・下=破壊）／跳：2段ジャンプ／掴：持ち運び／蹴：端まで吹き飛ばす／チャージ：緑全消去",
 mage:"魔法使い｜常時浮遊・方向キーで滑走／炎：上下左右ファイアボール／氷：正面アイスショット／風替：上下交換／風押：落下中スライムを横1列押す／チャージ：青全消去＋解凍"
};
let selectedClass=null;
function setActionLabels(){
 const labels=playerClass==="hero"?{grab:"掴",jump:"跳",attack:"剣",kick:"蹴"}:
 playerClass==="monk"?{grab:"持",jump:"二段",attack:"拳",kick:"蹴"}:
 {grab:"風替",jump:"風押",attack:"炎",kick:"氷"};
 for(const [k,v] of Object.entries(labels)){let el=document.querySelector('[data-key="'+k+'"]');if(el)el.textContent=v}
}
window.beginSelectedJob=function(job){
 if(!job)return;
 selectedClass=job;playerClass=job;hero.floating=playerClass==="mage";
 setActionLabels();
 try{startNormalStage(1)}catch(err){console.error(err);resetStageBoard();updateStageHud()}
 let cn=document.querySelector("#className");
 if(cn)cn.textContent="職業: "+(playerClass==="hero"?"勇者（赤・紅蓮斬）":playerClass==="monk"?"モンク（緑・翠気功波）":"魔法使い（青・蒼氷解放）");
};

document.querySelector("#nextStageBtn")?.addEventListener("click",()=>{
 document.querySelector("#stageMenu").style.display="none";
 if(bossMode){startNormalStage(1)}else if(stage>=3){startBossStage()}else{startNormalStage(stage+1)}
});
document.querySelector("#continueBtn")?.addEventListener("click",()=>{
 document.querySelector("#stageMenu").style.display="none";
 if(bossMode)startBossStage();else startNormalStage(stage);
});
document.querySelector("#titleBtn")?.addEventListener("click",()=>{
 document.querySelector("#stageMenu").style.display="none";bossMode=false;stage=1;resetStageBoard();updateStageHud();
 selectedClass=null;playerClass=null;window.pendingClass=null;document.querySelector("#classSelect").style.display="flex";
 document.querySelectorAll(".classBtn").forEach(x=>x.classList.remove("selected"));
 document.querySelector("#startBtn").disabled=true;document.querySelector("#classHelp").textContent="職業をタップすると操作説明が表示されます。";
});
const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",z:"jump",x:"attack",c:"grab",k:"kick"};
addEventListener("keydown",e=>{let k=map[e.key];if(!k)return;e.preventDefault();
 if(!e.repeat&&["left","right","up","down"].includes(k)){if(playerClass==="mage"&&(k==="left"||k==="right"))hero.face=k==="left"?-1:1}
 if(playerClass==="hero"&&hero.grab&&!e.repeat&&((hero.grab.down&&k!=="down"&&["left","right","up"].includes(k))||(!hero.grab.down&&((k==="left"&&hero.grab.side<0)||(k==="right"&&hero.grab.side>0)))))releaseHeroGrab();keys[k]=true;if(k==="jump"&&!e.repeat)jump();if(k==="grab"&&!e.repeat)grab();if(k==="kick"&&!e.repeat)kick();});
addEventListener("keyup",e=>{let k=map[e.key];if(!k)return;e.preventDefault();if(k==="attack")attack();keys[k]=false;if(k==="grab"){hero.grabHold=0;hero.grabColorTick=0}});
document.querySelectorAll("button[data-key]").forEach(b=>{let k=b.dataset.key;const down=e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch(_){}
 if(["left","right","up","down"].includes(k)){if(playerClass==="mage"&&(k==="left"||k==="right"))hero.face=k==="left"?-1:1}
 if(playerClass==="hero"&&hero.grab&&((hero.grab.down&&k!=="down"&&["left","right","up"].includes(k))||(!hero.grab.down&&((k==="left"&&hero.grab.side<0)||(k==="right"&&hero.grab.side>0)))))releaseHeroGrab();keys[k]=true;b.classList.add("pressed");if(k==="jump")jump();if(k==="grab")grab();if(k==="kick")kick();};const up=e=>{e.preventDefault();if(k==="attack"&&keys[k])attack();keys[k]=false;if(k==="grab"){hero.grabHold=0;hero.grabColorTick=0}b.classList.remove("pressed");try{if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId)}catch(_){}};b.addEventListener("pointerdown",down,{passive:false});b.addEventListener("pointerup",up,{passive:false});b.addEventListener("pointercancel",up,{passive:false});});
