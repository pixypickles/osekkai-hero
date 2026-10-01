window.addEventListener("error",function(e){
 const m=document.querySelector("#message");
 if(m){m.textContent="ERROR: "+(e.message||"unknown");m.style.display="block";}
});
const cv=document.querySelector("#game"),ctx=cv.getContext("2d");
const W=8,H=14,S=45,COLORS=["#59dc76","#ff5f78","#43aef5","#ffd85c"];
let board=Array.from({length:H},()=>Array(W).fill(null)),score=0,special=0,chain=0,chainPoints=0,GOAL=300,gameOver=false,cleared=false,playerClass=null;
let stage=1,bossMode=false,bossHp=30,bossMaxHp=30,bossHitT=0,bossSpawnT=0,bossLeftT=0,bossFireT=1200,bossFireballs=[]; let bossOnlyRun=false;
let enemies=[],enemySpawnT=0,demonSwordT=0,demonSwordFx=0,demonPhase=0,bossX=W-.62;
let gameMode="campaign",modeElapsed=0,bossChargeShotT=0;
let cloudMode=false,cloudY=0,cloudGoal=220,cloudPlatforms=[],cloudCannons=[],cloudShots=[],cloudSpawn=0,cloudCam=0,cloudGrip=null;
const cloudKinds=[
 {name:"赤",fill:"rgba(255,180,190,.72)",shade:"rgba(225,125,145,.42)",speed:.00100},
 {name:"青",fill:"rgba(180,220,255,.72)",shade:"rgba(115,175,225,.42)",speed:.00100},
 {name:"黄",fill:"rgba(255,240,170,.72)",shade:"rgba(225,195,100,.42)",speed:.00100},
 {name:"緑",fill:"rgba(185,245,205,.72)",shade:"rgba(120,205,150,.42)",speed:.00100}
];
function makeCloud(x,y,start=false,neutral=false){
 if(start)return {x,y,w:2,vy:0,fill:"rgba(245,250,255,.94)",shade:"rgba(185,220,245,.55)",start:true,neutral:true};
 let k=neutral?{fill:"rgba(245,250,255,.88)",shade:"rgba(190,220,240,.48)",name:null}:cloudKinds[Math.floor(Math.random()*cloudKinds.length)];
 let roll=Math.random(),vx=0,vy=0,motion="diag";
 if(neutral){vx=(Math.random()<.5?-1:1)*(.00038+Math.random()*.00022);vy=.00115+Math.random()*.00035}
 else if(roll<.78){vx=(Math.random()<.5?-1:1)*(.00072+Math.random()*.00048);vy=.00135+Math.random()*.00055;motion="diag"}
 else if(roll<.93){vx=(Math.random()<.5?-1:1)*(.00100+Math.random()*.00045);vy=.00010+Math.random()*.00018;motion="side"}
 else if(roll<.975){vx=(Math.random()-.5)*.00016;vy=.00155+Math.random()*.00050;motion="down"}
 else{vx=(Math.random()<.5?-1:1)*(.00018+Math.random()*.00022);vy=-(.00034+Math.random()*.00030);motion="up"}
 return {x,y,w:2,vy,vx,fill:k.fill,shade:k.shade,kind:k.name,motion,neutral};
}
function startCloudClimb(){
 if(playerClass==="mage"){msg("魔法使いは雲登りに参加できない！");return}
 cloudMode=true;bossMode=false;cleared=false;gameOver=false;cloudY=0;cloudCam=0;cloudPlatforms=[];cloudCannons=[];cloudShots=[];cloudSpawn=0;cloudGrip=null;cloudGoalReady=false;
 let em=document.querySelector("#message");if(em)em.textContent="";
 board=Array.from({length:H},()=>Array(W).fill(null));pairs=[];enemies=[];
 hero.x=W*.5;hero.y=H-1.4;hero.vx=hero.vy=0;hero.onGround=true;
 let startCloud=makeCloud(W*.5-1,.22,true);
 cloudPlatforms.push(startCloud);
 let ladderX=W*.5-1;
 for(let i=1;i<7;i++){
  ladderX=Math.max(.35,Math.min(W-2.35,ladderX+(Math.random()<.5?-1:1)*(0.25+Math.random()*.95)));
  let yy=.22+i*2.05;cloudPlatforms.push(makeCloud(ladderX,yy,false,true));
  if(i%2===0){let side=ladderX<W/2?Math.min(W-2.35,ladderX+2.2):Math.max(.35,ladderX-2.2);cloudPlatforms.push(makeCloud(side,yy+.45))}
 }
 hero.x=W*.5;hero.y=(H-startCloud.y-1)-.20;hero.vy=0;hero.onGround=true;hero._cloudPrevY=hero.y;
 msg("雲を乗り継いで頂上を目指せ！");
}
function spawnCloud(worldY){
 let x=.4+Math.floor(Math.random()*(W-2));
 cloudPlatforms.push({x,y:worldY,w:2,vy:.00012+Math.random()*.00005});
 // Cannons are occasional hazards, not a bullet curtain.
 if(worldY>18&&Math.random()<.16)cloudCannons.push({x:Math.random()<.5?.18:W-.18,y:worldY+1.4,side:Math.random()<.5?1:-1,t:1700+Math.random()*1700});
}
function updateCloudHero(dt){
 if(hero.stun>0){hero.stun=Math.max(0,hero.stun-dt)}
 if(cloudGrip){
   let c=cloudGrip;
   if(!cloudPlatforms.includes(c)){cloudGrip=null}else{
     let sy=H-c.y-1;
     hero.x=Math.max(c.x+.18,Math.min(c.x+c.w-.18,hero.x));
     hero.y=sy+.55;hero.vx=0;hero.vy=0;hero.onGround=false;
     // While hanging, left/right lets the player shimmy along the cloud.
     let sx=(keys.right?1:0)-(keys.left?1:0);hero.x=Math.max(c.x+.18,Math.min(c.x+c.w-.18,hero.x+sx*.0022*dt));
     return;
   }
 }
 let ax=(keys.right?1:0)-(keys.left?1:0);
 if(ax)hero.face=ax<0?-1:1;
 hero.vx=ax*.0036;
 hero.x=Math.max(.3,Math.min(W-.3,hero.x+hero.vx*dt));
 let oldY=hero.y;
 // Dedicated, stable cloud-mode gravity. Clamp vertical speed so double jump cannot become a rocket.
 hero.vy=Math.min(.0080,hero.vy+.000026*dt);
 let nextY=hero.y+hero.vy*dt;
 hero.onGround=false;
 if(hero.vy>=0){
  let best=null;
  for(const c of cloudPlatforms){
   let sy=H-c.y-1;
   if(hero.x>c.x-.18&&hero.x<c.x+c.w+.18&&oldY<=sy-.10&&nextY>=sy-.30){
    if(best==null||sy<best)best=sy;
   }
  }
  if(best!=null){nextY=best-.20;hero.vy=0;hero.onGround=true;hero.jumps=0}
 }
 hero.y=nextY;
 if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
}
function cloudGrab(){
 if(!cloudMode)return false;
 if(cloudGrip){cloudGrip=null;hero.vy=.001;msg("雲から手を離した！");return true}
 let best=null,bd=1.15;
 for(const c of cloudPlatforms){
   let sy=H-c.y-1;
   // Grab the underside/edge of a cloud that is just above or beside the character.
   let cx=Math.max(c.x,Math.min(c.x+c.w,hero.x)),d=Math.hypot(cx-hero.x,(sy+.28)-hero.y);
   if(d<bd){best=c;bd=d}
 }
 if(best){cloudGrip=best;hero.vx=hero.vy=0;msg("雲につかまった！");return true}
 msg("つかめる雲がない");return true;
}

function resolveCloudPairs(){
 // If two 2-wide cloud slimes of the same color touch/overlap as a 2x2-ish cluster, both pop.
 for(let i=0;i<cloudPlatforms.length;i++){
  let a=cloudPlatforms[i];if(a.start||!a.kind||a.pop)continue;
  for(let j=i+1;j<cloudPlatforms.length;j++){
   let b=cloudPlatforms[j];if(b.start||b.kind!==a.kind||b.pop)continue;
   let ax=a.x+1,bx=b.x+1,syA=H-a.y-1,syB=H-b.y-1;
   let bothVisible=syA>.25&&syA<H-.35&&syB>.25&&syB<H-.35;
   if(bothVisible&&Math.abs(ax-bx)<1.35&&Math.abs(syA-syB)<.72){
    a.pop=b.pop=true;
    effects.push({x:(ax+bx)/2,y:(syA+syB)/2,t:420,max:420,type:"wave",color:a.fill||"#fff"});
    msg(a.kind+"雲スライム 2×2消し！");
    break;
   }
  }
 }
 cloudPlatforms=cloudPlatforms.filter(c=>!c.pop);
}
function updateCloudMode(dt){
 let climbed=Math.max(0,hero._cloudPrevY-hero.y);
 cloudY+=climbed;
 hero._cloudPrevY=hero.y;
 // When the hero reaches the upper third, scroll the whole playfield down promptly.
 if(hero.y<3.6){
   let shift=(3.6-hero.y)*.72;
   hero.y+=shift;hero._cloudPrevY=hero.y;
   for(const c of cloudPlatforms)c.y-=shift;
   for(const k of cloudCannons)k.y-=shift;
   cloudY+=shift;
 }
 cloudCam=0; cloudSpawn+=dt;
 // The two-wide cloud slimes visibly descend. The player must climb faster than they fall.
 for(const c of cloudPlatforms){c.y-=c.vy*dt;if(c.vx){c.x+=c.vx*dt;if(c.x>W+.2)c.x=-c.w+.2;else if(c.x+c.w<-.2)c.x=W-.2}}
 resolveCloudPairs();
 if(cloudSpawn>1050&&!cloudGoalReady){
  cloudSpawn=0;
  let visible=cloudPlatforms.filter(c=>!c.start);
  let prev=visible.sort((a,b)=>b.y-a.y)[0];
  let px=prev?prev.x:W*.5-1;
  // One guaranteed reachable anchor, plus side clouds so there are multiple route choices.
  let anchorX=Math.max(.35,Math.min(W-2.35,px+(Math.random()<.5?-1:1)*(0.25+Math.random()*.95)));
  cloudPlatforms.push(makeCloud(anchorX,H+1.2,false,true));
  let extras=1+(Math.random()<.55?1:0);
  for(let n=0;n<extras;n++){
   let lane=.35+Math.random()*(W-2.7);
   if(Math.abs(lane-anchorX)<1.25)lane=lane<W/2?Math.min(W-2.35,lane+1.8):Math.max(.35,lane-1.8);
   cloudPlatforms.push(makeCloud(lane,H+1.2+n*.38));
  }
  if(cloudY>18&&Math.random()<.10)cloudCannons.push({x:Math.random()<.5?.18:W-.18,y:H-.8,t:2300+Math.random()*1800});
 }
 for(const k of cloudCannons){
  k.t-=dt;if(k.t<=0){k.t=3800+Math.random()*2400;let sy=H-k.y-1,dx=hero.x-k.x,dy=hero.y-sy,l=Math.hypot(dx,dy)||1;cloudShots.push({x:k.x,y:sy,dx:dx/l,dy:dy/l,t:3400})}
 }
 for(const s of cloudShots){s.x+=s.dx*.00225*dt;s.y+=s.dy*.00225*dt;s.t-=dt;if(Math.hypot(s.x-hero.x,s.y-hero.y)<.42){s.t=0;knockHero(s.dx>=0?1:-1);msg("魔王砲に撃たれた！")}}
 cloudShots=cloudShots.filter(s=>s.t>0&&s.x>-1&&s.x<W+1&&s.y>-1&&s.y<H+1);
 cloudPlatforms=cloudPlatforms.filter(c=>c.goal||c.y>-.8);
 if(cloudY>=cloudGoal&&!cloudGoalReady){
  cloudGoalReady=true;
  cloudPlatforms.push({x:W*.5-2.5,y:H-4,w:5,vy:0,vx:0,fill:"rgba(250,253,255,.98)",shade:"rgba(175,215,240,.72)",neutral:true,goal:true});
  msg("ゴールが見えた！ GOAL雲へ着地！");
 }
 let goal=cloudPlatforms.find(c=>c.goal);
 if(goal){
  let gsy=H-goal.y-1;
  if(hero.onGround&&hero.x>goal.x-.15&&hero.x<goal.x+goal.w+.15&&Math.abs((hero.y+.20)-gsy)<.38){
   cloudMode=false;cleared=true;msg("雲登り CLEAR！");
   let menu=document.querySelector("#stageMenu");if(menu)menu.style.display="none";
   let old=document.getElementById("cloudClearPanel");if(old)old.remove();
   let panel=document.createElement("div");panel.id="cloudClearPanel";panel.style.cssText="position:fixed;inset:0;z-index:80;background:rgba(5,18,35,.72);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-weight:900;font-size:28px;gap:20px";
   panel.innerHTML='<div>☁ 雲登り CLEAR！</div><button type="button" style="font-size:20px;padding:14px 28px;border-radius:14px;font-weight:900">タイトルへ戻る</button>';
   panel.querySelector("button").onclick=()=>location.reload();document.body.appendChild(panel);
  }
 }
 if(hero.y>H+.35){
  cloudY=Math.max(0,cloudY-28);
  cloudPlatforms=cloudPlatforms.filter(c=>c.start);
  let rescue=makeCloud(W*.5-1,.22,true);cloudPlatforms=[rescue];
  let rx=W*.5-1;
  for(let i=1;i<7;i++){rx=Math.max(.35,Math.min(W-2.35,rx+(Math.random()<.5?-1:1)*(0.25+Math.random()*.95)));let yy=.22+i*2.05;cloudPlatforms.push(makeCloud(rx,yy,false,true));if(i%2===0){let sx=rx<W/2?Math.min(W-2.35,rx+2.2):Math.max(.35,rx-2.2);cloudPlatforms.push(makeCloud(sx,yy+.45))}}
  hero.x=W*.5;hero.y=(H-rescue.y-1)-.20;hero.vx=hero.vy=0;hero.onGround=true;hero._cloudPrevY=hero.y;
  msg("落下！ 28m下から再開");
 }
}
let gameSettings={crushGameOver:false,bats:true,skeletons:true};
try{gameSettings={...gameSettings,...JSON.parse(localStorage.getItem("osekkaiSettings")||"{}")}}catch(e){}
window.setGameSetting=(k,v)=>{if(k in gameSettings){gameSettings[k]=!!v;try{localStorage.setItem("osekkaiSettings",JSON.stringify(gameSettings))}catch(e){}}};
window.getGameSettings=()=>({...gameSettings});

const heroDive={swordT:0,swordN:0,active:false,bossHit:false};
const monkCombo={punchT:0,punchN:0,kickT:0,kickN:0,moveT:0,kind:"",vx:0,bossCd:0};
const hero={x:3.5,y:H-1.55,vx:0,vy:0,w:.52,h:.92,onGround:false,grab:null,stun:0,charge:0,face:1,walk:0,attackT:0,attackDir:"right",attackPower:1,kickT:0,grabT:0,squashT:0,squeezeT:0,squeezeDir:0,carry:null,jumps:0,grabHold:0,grabColorTick:0,floating:false,liftRide:-1,liftPrevY:0,guard:false};
let pairs=[],pairSeq=0,spawnClock=0,keys={},last=performance.now(),fallSpeed=.00075,effects=[];
let fastFall=false; const FAST_FALL_MULT=4.2;

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
 spawnClock+=dt;
 if(!(bossMode&&bossTier===3)&&(pairs.length===0||(spawnClock>720&&pairs.every(p=>p.y>1.7)))){spawnPair();spawnClock=0}
 let landed=[];
 for(const p of [...pairs].sort((a,b)=>b.y-a.y)){
  p.aiClock+=dt;
  if(p.windLock>0)p.windLock=Math.max(0,p.windLock-dt);
  // Visible "human" inputs. After a mage wind push, wait before touching that piece again.
  if(!p.windLock&&p.aiClock>300+Math.random()*180){p.aiClock=0;if(p.x!==p.targetX){let nx=p.x+Math.sign(p.targetX-p.x);if(!pairBlocked(p,p.y,nx,p.orient))p.x=nx}
   else if(!p.rotated&&p.targetOrient==="h"&&p.y>-.45){if(!pairBlocked(p,p.y,p.x,"h")){p.orient="h";p.rotated=true;msg(["プレイヤー: ここかなぁ…","プレイヤー: どこにしよう？","プレイヤー: 悩むなぁ…","プレイヤー: こっちかな？","プレイヤー: よし、ここ！"][Math.floor(Math.random()*5)])}}
  }
  let next=p.y+fallSpeed*(fastFall?FAST_FALL_MULT:1)*dt;if(pairBlocked(p,next))landed.push(p);else p.y=next;
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
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&!board[y][x].frozen&&board[y][x].color!=="#aeb4bf"&&!vis[y][x]){
  let q=[[x,y]],g=[],col=board[y][x].color;vis[y][x]=true;
  while(q.length){let [cx,cy]=q.pop();g.push([cx,cy]);for(const[dX,dY]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=cx+dX,ny=cy+dY;if(nx>=0&&nx<W&&ny>=0&&ny<H&&!vis[ny][nx]&&board[ny][nx]?.color===col&&!board[ny][nx]?.frozen){vis[ny][nx]=true;q.push([nx,ny])}}}
  if(g.length>=4)groups.push(g);
 }
 if(!groups.length){chain=0;return}
 chain++;
 let chainGain=Math.max(0,chain-1),simulGain=Math.max(0,groups.length-1),gain=chainGain+simulGain;
 chainPoints+=gain;
 document.querySelector("#chainPoints").textContent=chainPoints;let gp=document.querySelector("#goalPoints");if(gp)gp.textContent=gameMode==="endless"?"∞":GOAL;
 if(gain>0)msg(`連鎖P +${gain}${simulGain?`（同時消し+${simulGain}）`:""}`);
 if(!bossMode&&gameMode!=="endless"&&chainPoints>=GOAL){finishStage();}
 let clearing=groups.flat();
 clearing.forEach(([x,y])=>{if(board[y][x])board[y][x].clearing=true;score+=10*chain;special=Math.min(100,special+3*chain)});
 msg(chain>1?`${chain} CHAIN!`:"消える！");
 setTimeout(()=>{clearing.forEach(([x,y])=>{board[y][x]=null});gravity();setTimeout(()=>resolve(),300)},520);
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
function updateLiftRide(){
 if(!bossMode||bossTier!==2){hero.liftRide=-1;return}
 const lifts=strongLiftRects();
 // Continue riding the same lift while horizontally over it.
 if(hero.liftRide>=0&&lifts[hero.liftRide]){
  const r=lifts[hero.liftRide];
  // Once aboard, the platform owns the vertical position. This prevents an ascending
  // lift from pushing through / ejecting the character between frames.
  if(hero.x>=r.x-.12&&hero.x<=r.x+r.w+.12&&hero.vy>=-.0032){
   hero.y=r.y-hero.h/2-.02;hero.vy=0;hero.onGround=true;hero.liftPrevY=r.y;return
  }
  hero.liftRide=-1;
 }
 // Acquire a lift when descending/standing just above its top.
 for(let i=0;i<lifts.length;i++){
  const r=lifts[i],feet=hero.y+hero.h/2;
  if(hero.x>=r.x-.12&&hero.x<=r.x+r.w+.12&&feet>=r.y-.28&&feet<=r.y+.28&&hero.vy>=0){
   hero.liftRide=i;hero.liftPrevY=r.y;hero.y=r.y-hero.h/2-.02;hero.vy=0;hero.onGround=true;return
  }
 }
}
function heroSolidAt(x,y,prevY=null){
 if(bossMode&&(bossTier===2||bossTier===3)){
  for(const r of strongLiftRects()){
   if(x>=r.x&&x<r.x+r.w&&y>=r.y-.18&&y<r.y+r.h+.18){
    // Moving lifts are one-way: rising through from below is allowed.
    if(hero.vy<0)return false;
    if(prevY!=null&&prevY>r.y+.18)return false;
    return true;
   }
  }
 }
 let ix=Math.floor(x),iy=Math.floor(y);
 return ix<0||ix>=W||iy>=H||(bossTier===1&&bossPlatformAt(x,y))||(iy>=0&&board[iy][ix]);
}
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
function nextHeroGrabColor(dir=1){
 // Fixed cycle: red -> yellow -> green -> blue -> red.
 const cycle=[COLORS[1],COLORS[3],COLORS[0],COLORS[2]];
 if(playerClass!=="hero"||!hero.grab)return;
 if(hero.grab.kind==="board"){
   let s=board[hero.grab.y]?.[hero.grab.x];if(!s)return;
   let i=cycle.indexOf(s.color);s.color=cycle[(i+dir+cycle.length)%cycle.length];
   slimeHurtEffect(hero.grab.x+.5,hero.grab.y+.5,s.color);
 }else if(hero.grab.kind==="pair"){
   let p=getPair(hero.grab.id);if(!p)return;let part=hero.grab.part;
   let type=part===0?p.a:p.b;if(type==null)return;let c=COLORS[type],i=cycle.indexOf(c),next=cycle[(i+dir+cycle.length)%cycle.length],ni=COLORS.indexOf(next);
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
 updateLiftRide();
 if(hero.guard&&!keys.grab)hero.guard=false;
 if(hero.stun>0){hero.stun=Math.max(0,hero.stun-dt);hero.vy+=.000024*dt;let sx=Math.max(.3,Math.min(W-.3,hero.x+hero.vx*dt));if(!solidAt(sx,hero.y)&&!heroHitsPair(sx,hero.y))hero.x=sx;else hero.vx=0;let sy=Math.min(H-.48,hero.y+hero.vy*dt);if(!heroSolidAt(hero.x,sy,hero.y)&&!heroHitsPair(hero.x,sy))hero.y=sy;else hero.vy=0;hero.vx*=Math.pow(.985,dt/16.67);return}
 if(playerClass==="mage"){
  hero.grab=null;hero.onGround=false;hero.floating=true;
  let ax=(keys.right?1:0)-(keys.left?1:0),ay=(keys.down?1:0)-(keys.up?1:0);
  if(ax)hero.face=ax<0?-1:1;
  hero.vx=hero.vx*(ax?.78:.42)+ax*.00070*dt;
  hero.vy=hero.vy*(ay?.78:.42)+ay*.00070*dt;
  hero.vx=Math.max(-.0048,Math.min(.0048,hero.vx));hero.vy=Math.max(-.0048,Math.min(.0048,hero.vy));
  hero.x=Math.max(.35,Math.min(W-.35,hero.x+hero.vx*dt));
  hero.y=Math.max(.75,Math.min(H-.75,hero.y+hero.vy*dt));
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
       // Push and pull are both allowed over an edge. If there is no footing,
       // the grabbed slime and hero become one falling unit instead of refusing the pull.
       let pushing = (g.side<0&&dir>0)||(g.side>0&&dir<0);
       if(destinationFree){
         let moved=board[g.y][g.x];board[g.y][g.x]=null;
         if(!supported){
           let type=COLORS.indexOf(moved.color);
           let fp={id:++pairSeq,x:nx,y:g.y,a:type,b:null,hpA:moved.hp||2,hpB:0,orient:"v",targetX:nx,targetOrient:"v",aiClock:0,rotated:true,windLock:999999};
           pairs.push(fp);
           hero.grab={kind:"pair",id:fp.id,part:0,side:g.side};
           hero.x=nx+.5+(g.side||-1)*.48;hero.y=g.y+.52;hero.vx=0;hero.vy=0;
           msg(pushing?"押したまま落下！":"引っ張ったまま落下！");
         }else{
           board[g.y][nx]=moved;hero.grab={kind:"board",x:nx,y:g.y,side:g.side};hero.x=nx+.5+(g.side||-1)*.52;
         }
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
     if(gameSettings.crushGameOver){
        gameOver=true;hero.squeezeT=0;msg("押し潰された！");
        let result=document.querySelector("#stageResult"),info=document.querySelector("#stageInfo");
        if(result)result.textContent="GAME OVER";
        if(info)info.textContent="シビア設定：スライムの下敷きでゲームオーバー";
        let cont=document.querySelector("#continueBtn"),next=document.querySelector("#nextStageBtn");
        if(cont)cont.style.display="inline-block";if(next)next.style.display="none";
        document.querySelector("#stageMenu").style.display="flex";return;
      }
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
function mageEscapeFromPocket(){if(playerClass!=="mage")return false;let L=solidAt(hero.x-.58,hero.y)||heroHitsPair(hero.x-.58,hero.y),R=solidAt(hero.x+.58,hero.y)||heroHitsPair(hero.x+.58,hero.y),U=solidAt(hero.x,hero.y-.58)||heroHitsPair(hero.x,hero.y-.58),D=solidAt(hero.x,hero.y+.58)||heroHitsPair(hero.x,hero.y+.58);if(!((L&&R)||(U&&D)))return false;for(const [dx,dy] of [[0,-1.05],[hero.face*.95,0],[-hero.face*.95,0],[0,.95]]){let nx=hero.x+dx,ny=hero.y+dy;if(nx>.35&&nx<W-.35&&ny>.35&&ny<H-.35&&!solidAt(nx,ny)&&!heroHitsPair(nx,ny)){hero.x=nx;hero.y=ny;hero.vx=dx*.0018;hero.vy=dy*.0018;msg("風で脱出！");return true}}if(L&&R){hero.y=Math.max(.4,hero.y-.72);hero.vy=-.0025;msg("風で上へ脱出！");return true}return false}
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
 if(cloudMode){
   if(cloudGrip){cloudGrip=null;hero.vy=playerClass==="monk"?-.0138:-.0144;hero.onGround=false;if(playerClass==="monk")hero.jumps=1;return}
   if(playerClass==="monk"){
     if(hero.onGround){hero.vy=-.0138;hero.jumps=1;hero.onGround=false;return}
     if(hero.jumps===1){hero.vy=-.0105;hero.jumps=2;return}
     return;
   }
   if(hero.onGround){hero.vy=-.0144;hero.onGround=false}
   return;
 }
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

function knockHero(dir,label="吹き飛ばされた！ 2秒ダウン！"){
 if(hero.stun>0)return;
 hero.grab=null;hero.guard=false;hero.stun=2000;hero.attackT=0;hero.kickT=0;hero.grabT=0;hero.charge=0;
 hero.vx=.0065*dir;hero.vy=-.0048;hero.x=Math.max(.35,Math.min(W-.35,hero.x+dir*.38));
 effects.push({x:hero.x,y:hero.y,t:260,max:260,type:"hit",color:"#ffb15a"});msg(label);
}
function spawnNeutralDrop(x){
 x=Math.max(0,Math.min(W-1,Math.floor(x)));
 pairs.push({id:++pairSeq,x,y:-1,a:-1,b:null,hpA:3,hpB:0,orient:"v",targetX:x,targetOrient:"v",aiClock:999999,rotated:true,windLock:999999});
}
function spawnBat(){
 let fromLeft=Math.random()<.5;
 enemies.push({type:"bat",x:fromLeft?-.4:W+.4,y:2+Math.random()*4,vx:fromLeft?.00125:-.00125,hp:1,t:12000,dropT:1100+Math.random()*1200,phase:Math.random()*6.28});
}
function spawnSkeleton(){
 let fromLeft=Math.random()<.5;
 if(enemies.some(e=>e.type==="skeleton"&&!e.dead))return;
 enemies.push({type:"skeleton",x:fromLeft?.35:W-.35,y:H-.68,vx:0,vy:0,hp:2,t:15000,attackT:700+Math.random()*700,jumpT:900+Math.random()*1000,curseT:2600+Math.random()*2600,swingT:0,face:fromLeft?1:-1});
}
function enemyHitRay(x,y,dx,dy,range,width=.5,power=1){
 let best=null;
 for(const e of enemies){let rx=e.x-x,ry=e.y-y,along=rx*dx+ry*dy,side=Math.abs(rx*(-dy)+ry*dx);
  let extra=e.type==="skeleton"?.42:0,back=e.type==="skeleton"?.28:0;
  if(along>=-back&&along<=range+extra&&side<width+extra&&(!best||along<best.along))best={e,along};
 }
 if(!best)return false;
 best.e.hp-=power;hitEffect(best.e.x,best.e.y,"#fff2a8");
 if(best.e.hp<=0){effects.push({x:best.e.x,y:best.e.y,t:300,max:300,type:"hit",color:"#d9d0ff"});best.e.dead=true;msg(best.e.type==="bat"?"使い魔を倒した！":"スケルトン撃破！")}
 return true;
}
function updateEnemies(dt){
 if(bossMode||stage<4)return;
 enemySpawnT-=dt;
 if(enemySpawnT<=0){
  if(gameSettings.bats&&stage>=4&&Math.random()<.72)spawnBat();
  if(gameSettings.skeletons&&stage>=7&&Math.random()<.62)spawnSkeleton();
  enemySpawnT=stage>=7?4200+Math.random()*3200:6500+Math.random()*5000;
 }
 for(const e of enemies){
  e.t-=dt;
  if(e.type==="bat"){
   e.phase+=dt*.004;e.x+=e.vx*dt;e.y+=Math.sin(e.phase)*.00045*dt;e.dropT-=dt;
   if(e.dropT<=0&&e.x>.5&&e.x<W-.5){spawnNeutralDrop(e.x);e.dropT=999999;msg("使い魔が無色スライムを落とした！")}
  }else{
   e.face=hero.x<e.x?-1:1;
   let dx=hero.x-e.x;
   if(Math.abs(dx)>.78)e.x+=Math.sign(dx)*.00115*dt;
   e.jumpT-=dt;if(e.jumpT<=0){e.vy=-.0105;e.jumpT=1300+Math.random()*1300}
   e.vy+=.000024*dt;e.y+=e.vy*dt;if(e.y>H-.68){e.y=H-.68;e.vy=0}
   e.curseT-=dt;
   if(e.curseT<=0){
    let targets=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&board[y][x].color!=="#aeb4bf")targets.push({kind:"board",x,y});
    for(const p of pairs)for(const part of [0,1]){let v=part===0?p.a:p.b;if(v!=null&&v!==-1)targets.push({kind:"pair",p,part})}
    if(targets.length){
     let q=targets[Math.floor(Math.random()*targets.length)];
     if(q.kind==="board"){q.board=board[q.y][q.x];q.board.color="#aeb4bf";q.board.hp=3;q.board.frozen=false;slimeHurtEffect(q.x+.5,q.y+.5,"#aeb4bf")}
     else if(q.part===0){q.p.a=-1;q.p.hpA=3}else{q.p.b=-1;q.p.hpB=3}
     msg("スケルトンがスライムを無色にした！");
    }
    e.curseT=4200+Math.random()*3600;
   }
   e.attackT-=dt;e.swingT=Math.max(0,(e.swingT||0)-dt);
   if(Math.abs(hero.x-e.x)<1.05&&Math.abs(hero.y-e.y)<1.05&&e.attackT<=0){
    e.attackT=1200;e.swingT=260;
    if(hero.guard&&(playerClass==="hero"||playerClass==="monk"))msg("ガード！");
    else knockHero(e.face,"スケルトンの剣！ 2秒ダウン！");
   }
  }
 }
 enemies=enemies.filter(e=>!e.dead&&e.t>0&&e.x>-1&&e.x<W+1);
}
function drawEnemies(){
 for(const e of enemies){ctx.save();ctx.translate(e.x,e.y);
  if(e.type==="bat"){
   ctx.fillStyle="#33264d";ctx.beginPath();ctx.arc(0,0,.18,0,Math.PI*2);ctx.fill();
   ctx.beginPath();ctx.moveTo(-.12,0);ctx.quadraticCurveTo(-.48,-.28,-.52,.05);ctx.quadraticCurveTo(-.34,-.02,-.12,.12);ctx.fill();
   ctx.beginPath();ctx.moveTo(.12,0);ctx.quadraticCurveTo(.48,-.28,.52,.05);ctx.quadraticCurveTo(.34,-.02,.12,.12);ctx.fill();
   ctx.fillStyle="#ff6f8f";ctx.fillRect(-.08,-.04,.04,.04);ctx.fillRect(.04,-.04,.04,.04);
  }else{
   ctx.fillStyle="#ddd9cf";ctx.beginPath();ctx.arc(0,-.48,.22,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#392b48";ctx.beginPath();ctx.arc(-.075,-.51,.042,0,Math.PI*2);ctx.arc(.075,-.51,.042,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#9ef2ff";ctx.beginPath();ctx.arc(-.075,-.515,.018,0,Math.PI*2);ctx.arc(.075,-.515,.018,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#d9d4ca";ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(0,-.25);ctx.lineTo(0,.35);ctx.moveTo(-.22,-.05);ctx.lineTo(.22,-.05);ctx.moveTo(0,.32);ctx.lineTo(-.2,.62);ctx.moveTo(0,.32);ctx.lineTo(.2,.62);ctx.stroke();
   let sw=e.swingT>0?1-e.swingT/260:0,ang=e.swingT>0?(-1.05+sw*2.15):-.65;
   let sx=.2*e.face,sy=-.08,ex=sx+Math.cos(ang)*.58*e.face,ey=sy+Math.sin(ang)*.58;
   ctx.strokeStyle="#d7e8ff";ctx.lineWidth=.065;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
   if(e.swingT>0){ctx.strokeStyle="rgba(220,240,255,.55)";ctx.lineWidth=.035;ctx.beginPath();ctx.arc(.18*e.face,-.08,.62,e.face>0?-1.1:.0,e.face>0?1.0:2.1);ctx.stroke()}
  }ctx.restore()}
}
function hitEffect(x,y,color="#fff"){
 effects.push({x,y,t:220,max:220,type:"hit",color});
}
function slimeHurtEffect(x,y,color){
 effects.push({x,y,t:280,max:280,type:"slime",color});
}
function attackHitsBoss(x,y,dx,dy,range,width=.55){
 if(!bossMode)return false;
 let rx=((bossTier===3?bossX:W-.62)-x),ry=bossY-y,along=rx*dx+ry*dy,side=Math.abs(rx*(-dy)+ry*dx);
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
function chargedWave(){
 if(playerClass!=="hero"&&playerClass!=="monk"&&playerClass!=="mage")return false;
 let isHero=playerClass==="hero",isMage=playerClass==="mage",dx=hero.face,dy=0,tx=null,ty=null;
 if(bossMode){
  tx=bossTier===3?bossX:W-.62;ty=bossY;let rx=tx-hero.x,ry=ty-hero.y,len=Math.hypot(rx,ry)||1;dx=rx/len;dy=ry/len;
 }else{
  // Normal stages: the visible wave itself now erases slimes as it reaches them.
  // This keeps 聖剣波 / 気功波 animation synchronized with disappearance.
  dy=0;dx=hero.face;
 }
 let col=isHero?"#ff334f":isMage?"#ff7a22":"#9dffb0";
 effects.push({x:hero.x,y:hero.y,t:1800,max:1800,type:bossMode?"bossWave":isHero?"crescentProjectile":isMage?"giantFireProjectile":"kiProjectile",color:col,dx,dy,speed:isHero?.0125:isMage?.0115:.0108,isHero,isMage,travel:0,hit:false});
 if(bossMode){
  // Collision is processed over time in update(), synchronized with the visible projectile.
 }
 return true;
}

function monkComboStart(kind){
 monkCombo.moveT=kind==="upper"?430:390;monkCombo.kind=kind;monkCombo.bossCd=0;
 if(kind==="upper"){hero.vy=-.012;msg("昇龍アッパー！")}
 else{monkCombo.vx=hero.face*.0095;hero.vy=Math.min(hero.vy,-.002);msg("飛び蹴り！")}
}
function monkComboUpdate(dt){
 if(playerClass!=="monk"||monkCombo.moveT<=0)return;
 monkCombo.moveT-=dt;monkCombo.bossCd=Math.max(0,monkCombo.bossCd-dt);
 if(monkCombo.kind==="upper")hero.vy=Math.min(hero.vy,-.0055);
 else hero.x=Math.max(.3,Math.min(W-.3,hero.x+monkCombo.vx*dt));
 let changed=false,rad=.7;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&Math.hypot(x+.5-hero.x,y+.5-hero.y)<rad){hitEffect(x+.5,y+.5,"#b78cff");board[y][x]=null;changed=true}
 for(const p of pairs)for(const part of [0,1]){
  if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
  let z=pairPos(p,part);if(Math.hypot(z.x+.5-hero.x,z.y+.5-hero.y)<rad){hitEffect(z.x+.5,z.y+.5,"#b78cff");if(part===0)p.a=null;else p.b=null;changed=true}
 }
 if(bossMode&&bossRectHit(hero.x,hero.y,1.0)&&monkCombo.bossCd<=0){bossDamage(2,monkCombo.kind==="upper"?"昇龍アッパー！":"飛び蹴り！");monkCombo.bossCd=150}
 if(changed){gravity();resolve()}
 if(monkCombo.moveT<=0)monkCombo.kind="";
}

function heroDiveStart(){
 if(playerClass!=="hero"||hero.onGround)return false;
 heroDive.active=true;heroDive.bossHit=false;hero.vx=0;hero.vy=.020;
 msg("雷剣急降下！");
 effects.push({type:"hit",x:hero.x,y:hero.y+.55,t:300,max:300,color:"#ffe45c"});
 return true
}
function heroDiveUpdate(dt){
 if(playerClass!=="hero"||!heroDive.active)return;
 hero.vx=0;hero.vy=Math.max(hero.vy,.020);
 let changed=false;
 // Sword points straight down: narrow vertical hitbox under the hero.
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]){
  if(Math.abs(x+.5-hero.x)<.48 && y+.5>=hero.y-.05 && y+.5<=hero.y+1.05){
   hitEffect(x+.5,y+.5,"#ffe45c");board[y][x]=null;changed=true
  }
 }
 for(const p of pairs)for(const part of [0,1]){
  if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
  let z=pairPos(p,part);
  if(Math.abs(z.x+.5-hero.x)<.48 && z.y+.5>=hero.y-.05 && z.y+.5<=hero.y+1.05){
   hitEffect(z.x+.5,z.y+.5,"#ffe45c");if(part===0)p.a=null;else p.b=null;changed=true
  }
 }
 if(bossMode&&!heroDive.bossHit&&bossRectHit(hero.x,hero.y+.45,1.15)){
  bossDamage(8,"雷剣急降下！");heroDive.bossHit=true
 }
 if(changed){gravity();resolve()}
 if(hero.onGround||hero.y>=H-.55){
  heroDive.active=false;hero.vy=0;
  effects.push({type:"hit",x:hero.x,y:hero.y,t:360,max:360,color:"#fff19a"});
 }
}
function attack(){
 if(playerClass==="hero"&&!hero.onGround){
  let now=performance.now();heroDive.swordN=now-heroDive.swordT<360?heroDive.swordN+1:1;heroDive.swordT=now;
  if(heroDive.swordN>=3){heroDive.swordN=0;if(heroDiveStart())return}
 }
 if(playerClass==="monk"){let now=performance.now();monkCombo.punchN=now-monkCombo.punchT<360?monkCombo.punchN+1:1;monkCombo.punchT=now;if(monkCombo.punchN>=3){monkCombo.punchN=0;monkComboStart("upper");return}}
 let charged=hero.charge>=75;hero.charge=0;
 if(charged&&(playerClass==="hero"||playerClass==="monk"||playerClass==="mage")){hero.attackT=180;chargedWave();return}
 if(playerClass==="hero"&&hero.grab){hero.attackDir=keys.up?"up":keys.down?"down":hero.face>0?"right":"left";hero.attackT=150;destroyHeroGrabbed();return}
 if(charged&&special>=100){doSpecial();return}
 hero.attackDir=keys.up?"up":keys.down?"down":hero.face>0?"right":"left";hero.attackT=150;
 if(playerClass==="hero"&&!bossMode){let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}if(enemyHitRay(hero.x,hero.y,dx,dy,charged?2.05:1.25,.55,charged?2:1))return}
 if(playerClass==="hero"&&bossMode){let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}
 if(bossTier===3&&demonSwordFx>0&&Math.hypot(hero.x-bossX,hero.y-bossY)<2.0){demonSwordFx=0;demonSwordT=700;effects.push({x:(hero.x+bossX)/2,y:(hero.y+bossY)/2,t:300,max:300,type:"hit",color:"#fff1a8"});msg("魔王の剣を弾いた！");return}
 if(cancelBossFireAlong(hero.x,hero.y,dx,dy,1.55,"聖剣で相殺！"))return;if(attackHitsBoss(hero.x,hero.y,dx,dy,1.8,.45)){bossDamage(2,"剣撃！");return}}

 if(playerClass==="mage"){
  let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}
  effects.push({x:hero.x,y:hero.y,t:360,max:360,type:"projectile",color:"#ff8a3d",dx,dy});
  if(!bossMode&&enemyHitRay(hero.x,hero.y,dx,dy,4.8,.48,1))return;
  if(attackHitsBoss(hero.x,hero.y,dx,dy,5.2,.38)){bossDamage(1,"ファイアボール！");return}
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dx*r,fy=hero.y+dy*r;
   for(const p of pairs)for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(pairPos(p,part).x+.5-fx)<.38&&Math.abs(pairPos(p,part).y+.5-fy)<.38){if(part===0)p.a=null;else p.b=null;hitEffect(pairPos(p,part).x+.5,pairPos(p,part).y+.5,"#ff8a3d");return}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){hitEffect(tx+.5,ty+.5,"#ff8a3d");if(board[ty][tx].frozen){board[ty][tx].frozen=false;msg("解凍！");gravity();resolve();return}board[ty][tx]=null;gravity();resolve();return}
  }return;
 }
 if(playerClass==="monk"&&!bossMode){let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}if(enemyHitRay(hero.x,hero.y,dx,dy,1.45,.6,1))return}
 if(playerClass==="monk"&&bossMode){let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}if(cancelBossFireAlong(hero.x,hero.y,dx,dy,1.25,"拳で相殺！"))return;if(attackHitsBoss(hero.x,hero.y,dx,dy,1.5,.45)){bossDamage(2,"拳撃！");return}}
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
 if(cloudMode){cloudGrab();return}
 hero.guard=false;hero.grabT=220;hero.grabHold=0;hero.grabColorTick=0;
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
   let cx=Math.floor(hero.x),cy=Math.floor(hero.y),cand=[[cx+hero.face,cy],[cx+hero.face,cy-1],[cx,cy-1],[cx,cy]];for(const [x,y] of cand)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){hero.carry=board[y][x];board[y][x]=null;gravity();resolve();return}
   hero.guard=true;msg("ガード！");return;
 }
 if(hero.grab){releaseHeroGrab();msg("離した！");return}
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
 let candidates=[[cx+hero.face,cy],[cx+hero.face,cy-1],[cx+hero.face,cy+1],[cx+hero.face*2,cy],[cx,cy-1],[cx,cy],[cx-hero.face,cy],[cx,cy+1]];for(const [x,y] of candidates)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){let side=hero.x<x+.5?-1:1;hero.grab={kind:"board",x,y,side};hero.vx=0;hero.vy=0;hero.x=x+.5+side*.52;hero.y=y+.18;return} hero.guard=true;msg("ガード！");
}
function kickHeroGrabbed(){
 if(playerClass!=="hero"||!hero.grab)return false;
 let dir=hero.face,g=hero.grab;hero.kickT=180;
 if(g.kind==="pair"){let p=getPair(g.id);if(!p){hero.grab=null;return false}let part=g.part,z=pairPos(p,part),nx=p.x+dir;if(nx<0||nx>=W){if(part===0)p.a=null;else p.b=null}else{p.x=nx;p.targetX=nx;p.windLock=450}hero.grab=null;msg("蹴り飛ばし！");return true}
 if(g.kind==="board"){let x=g.x,y=g.y,m=board[y]?.[x];if(!m){hero.grab=null;return false}let nx=x+dir;if(nx>=0&&nx<W&&!board[y][nx]){board[y][x]=null;board[y][nx]=m;hero.grab=null;gravity();resolve();msg("蹴り飛ばし！");return true}hero.grab=null;return false}
 return false;
}
function kick(){
 if(playerClass==="monk"){let now=performance.now();monkCombo.kickN=now-monkCombo.kickT<360?monkCombo.kickN+1:1;monkCombo.kickT=now;if(monkCombo.kickN>=3){monkCombo.kickN=0;monkComboStart("flyingKick");return}}
 if(playerClass==="hero"&&hero.grab&&kickHeroGrabbed())return;
 if(playerClass==="hero"&&bossMode&&bossRectHit(hero.x+hero.face*1.0,hero.y,.9)){hero.kickT=180;bossDamage(2,"蹴り！");return}
 hero.kickT=180;let dir=hero.face,hy=Math.floor(hero.y);
 if(playerClass==="mage"){
  let dir=hero.face;effects.push({x:hero.x,y:hero.y,t:360,max:360,type:"projectile",color:"#9de9ff",dx:dir,dy:0});
  if(bossMode&&cancelBossFireAlong(hero.x,hero.y,dir,0,4.5,"アイスショットで相殺！"))return;
  for(let r=.45;r<=4.5;r+=.25){let fx=hero.x+dir*r,fy=hero.y;if(bossRectHit(fx,fy,.55)){bossDamage(1,"アイスショット！");return}
   for(const p of [...pairs])for(const part of [0,1]){if((part===0&&p.a==null)||(part===1&&p.b==null))continue;if(Math.abs(pairPos(p,part).x+.5-fx)<.38&&Math.abs(pairPos(p,part).y+.5-fy)<.42){let type=part===0?p.a:p.b,ty=Math.max(0,Math.min(H-1,Math.floor(p.y+part+.5)));if(!board[ty][p.x]){let s=makeSlime(type);s.frozen=true;board[ty][p.x]=s;if(part===0)p.a=null;else p.b=null;msg("凍結！")}return}}
   let tx=Math.floor(fx),ty=Math.floor(fy);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){board[ty][tx].frozen=true;msg("凍結！");return}
  }return;
 }
 if(playerClass==="monk"&&bossMode&&bossRectHit(hero.x+hero.face*1.0,hero.y,1.0)){hero.kickT=180;bossDamage(2,"モンクキック！");return}
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
 let cp=document.querySelector("#chainPoints");if(cp)cp.textContent="0";let gp=document.querySelector("#goalPoints");if(gp)gp.textContent=gameMode==="endless"?"∞":GOAL;
 document.querySelector("#message").textContent="";
 document.querySelector("#message").classList.remove("clear");
}
function updateStageHud(){
 let s=document.querySelector("#stageText");if(s)s.textContent=bossMode?(bossTier===3?"魔王":bossTier===2?"BOSS 2":"BOSS"):stage;
 let bh=document.querySelector("#bossHud");if(bh)bh.style.display=bossMode?"inline":"none";
 let hp=document.querySelector("#bossHpText");if(hp)hp.textContent=Math.max(0,bossHp)+" / "+bossMaxHp;let hb=document.querySelector("#bossHpBar");if(hb)hb.style.width=(bossMaxHp?Math.max(0,bossHp)/bossMaxHp*100:0)+"%";
 let cp=document.querySelector("#chainPoints");if(cp)cp.textContent=String(chainPoints);let gp=document.querySelector("#goalPoints");if(gp)gp.textContent=gameMode==="endless"?"∞":GOAL;
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
 if(!job)return; gameMode="campaign";modeElapsed=0;setModeHud();bossOnlyRun=true;
 selectedClass=job;playerClass=job;
 hero.floating=playerClass==="mage";
 setActionLabels();
 startBossStage();
 let cn=document.querySelector("#className");
 if(cn)cn.textContent="職業: "+(playerClass==="hero"?"勇者（青・紅蓮斬）":playerClass==="monk"?"モンク（黄橙・翠気功波）":"魔法使い（青・蒼氷解放）");
};
function finishStage(){
 if(cleared)return;cleared=true;
 let nextBtn=document.querySelector("#nextStageBtn"),contBtn=document.querySelector("#continueBtn");
 if(nextBtn)nextBtn.style.display="block";if(contBtn)contBtn.style.display="none";
 let result=document.querySelector("#stageResult"),info=document.querySelector("#stageInfo");
 if(result)result.textContent=gameMode==="timeAttack"?"TIME ATTACK CLEAR!":bossMode?"BOSS CLEAR!":"STAGE CLEAR!";
 if(gameMode==="timeAttack"){
  if(info)info.textContent=`20ポイント到達！ タイム ${(modeElapsed/1000).toFixed(2)}秒`;
  if(nextBtn)nextBtn.style.display="none";
 }else if(info)info.textContent=bossMode?(bossTier===1?"ボス撃破！ 次はステージ4へ。":bossTier===2?"強ボス撃破！ 次はステージ7へ。":"魔王撃破！ ステージ1へ。"):(stage===3||stage===6||stage===9?"次はボス戦です。":"次は落下が少し激しくなります。");
 document.querySelector("#stageMenu").style.display="flex";
}
function startNormalStage(n){
 stage=n;bossMode=false;GOAL=12;enemies=[];enemySpawnT=stage>=7?2600:stage>=4?4200:999999;resetStageBoard();
 // Start with a little material already on the field.
 seedOpeningBoard();
 // Class-specific placement is handled after the common stage boot.
 spawnClock=0;
 updateStageHud();
}
function strongLiftRects(){if(!bossMode||(bossTier!==2&&bossTier!==3))return [];if(bossTier===3){let t=performance.now()*.001;return [{x:2,y:H*.72+Math.sin(t*.62)*.75,w:1,h:.28,moving:true},{x:5,y:H*.63+Math.sin(t*.52+2.0)*.7,w:1,h:.28,moving:true}]}let t=performance.now()*.001;return [{x:1,y:2.2+(Math.sin(t*.72)+1)*(H-4.0)/2,w:1,h:.28,moving:true},{x:6,y:2.8+(Math.sin(t*.58+2.1)+1)*(H-4.6)/2,w:1,h:.28,moving:true},{x:4,y:H*.56,w:1,h:.28,moving:false}]}
function bossPlatformAt(x,y){if(!bossMode)return false;if(bossTier===2||bossTier===3)return strongLiftRects().some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y-.18&&y<r.y+r.h+.18);return false}
function seedBossPlatforms(){
 let cells=[[1,H-1],[2,H-1],[4,H-1],[6,H-1],[6,H-2]];
 for(const [x,y] of cells)if(x>=0&&x<W&&y>=0&&y<H&&!board[y][x])board[y][x]=makeSlime(-1);
}
function startBossStage(tier=1){
 try{localStorage.setItem("osekkaiBossUnlocked","1")}catch(e){}
 let bb=document.querySelector("#bossOnlyBtn");if(bb)bb.style.display="block";
 bossMode=true;bossTier=tier;bossMaxHp=tier===3?64:tier===2?48:30;bossHp=bossMaxHp;bossLeftT=450;enemies=[];demonPhase=0;demonSwordT=900;demonSwordFx=0;
 bossSpawnT=0;bossFireT=tier===3?1100:tier===2?650:900;bossFireballs=[];bossDir=1;
 resetStageBoard();
 hero.floating=playerClass==="mage";
 if(playerClass==="mage"){hero.y=H-3.0;hero.vy=0}else{hero.y=H-1.2;hero.vy=0}
 bossY=tier===3?H*.68:tier===2?H*.48:H-3.95;
 /* Boss arenas stay clear: no seeded footholds. */
 updateStageHud();msg(tier===3?"魔王戦！":tier===2?"STRONG BOSS!":"BOSS!");
}
function bossDamage(amount,label="HIT!"){
 if(!bossMode||bossHp<=0)return false;
 bossHp=Math.max(0,bossHp-amount);bossHitT=180;updateStageHud();msg(label);
 if(bossHp<=0){try{if(bossTier===2)localStorage.setItem("osekkaiStrongBossCleared","1");if(bossTier===3)localStorage.setItem("osekkaiDemonCleared","1")}catch(e){}finishStage()}return true;
}
function bossRectHit(x,y,range=.75){
 return bossMode && Math.abs(x-(W-.62))<range && Math.abs(y-bossY)<1.35;
}
function spawnBossSingle(){
 let neutral=bossTier===2||Math.random()<.22;
 let type=neutral?-1:Math.floor(Math.random()*COLORS.length);
 let spawnX;
 if(bossTier===2){
  // Keep all lift columns (moving and fixed) completely clear of falling slimes.
  const liftCols=new Set(strongLiftRects().map(r=>Math.floor(r.x)));
  const cols=[];for(let x=0;x<Math.max(1,W-2);x++)if(!liftCols.has(x))cols.push(x);
  spawnX=cols[Math.floor(Math.random()*cols.length)]??0;
 }else spawnX=Math.floor(Math.random()*Math.max(1,W-2));
 let p={id:(Date.now()+Math.random()),x:spawnX,y:-1,a:type,b:null,hpA:neutral?3:2,hpB:0,rot:0,targetX:0,targetRot:0,aiT:999};
 p.targetX=p.x;pairs.push(p);
}
function spawnBossLeftNeutral(){
 // Constant pressure lane: a single neutral slime always enters from the far left.
 let p={id:(Date.now()+Math.random()),x:0,y:-1,a:-1,b:null,hpA:3,hpB:0,rot:0,targetX:0,targetRot:0,aiT:999,windLock:999999};
 p.targetX=0;pairs.push(p);
}
function updateBoss(dt){
 if(!bossMode)return;
 if(bossTier===3){
  demonPhase+=dt*.00072;bossX=W*.5+Math.cos(demonPhase)*2.35;bossY=H*.68+Math.sin(demonPhase)*1.05;
  demonSwordT-=dt;demonSwordFx=Math.max(0,demonSwordFx-dt);
  if(demonSwordT<=0&&Math.hypot(hero.x-bossX,hero.y-bossY)<1.55){
   demonSwordT=1250;demonSwordFx=300;
   if(hero.guard&&(playerClass==="hero"||playerClass==="monk"))msg("魔王の剣をガード！");
   else knockHero(hero.x<bossX?-1:1,"魔王の剣！ 2秒ダウン！");
  }
 }else if(bossTier===2){
  bossY+=bossDir*.00115*dt;
  if(bossY>H-2.2){bossY=H-2.2;bossDir=-1}
  if(bossY<2.0){bossY=2.0;bossDir=1}
 }
 bossSpawnT-=dt;
if(bossSpawnT<=0){
 if(bossTier===3){spawnNeutralDrop(Math.random()<.5?0:W-1)}else spawnBossSingle();
 // Overall random rain is a little lighter; the left lane supplies the main board pressure.
 bossSpawnT=bossTier===3?2100+Math.random()*900:bossTier===2?1500+Math.random()*600:1350+Math.random()*650;
}
bossLeftT-=dt;
if(bossLeftT<=0){
 if(bossTier!==3)spawnBossLeftNeutral();
 // One-by-one neutral slimes keep threatening the far-left column.
 bossLeftT=bossTier===3?999999:bossTier===2?2800:3400;
}
 if(bossHitT>0)bossHitT-=dt;
 bossFireT-=dt;
 if(bossFireT<=0){
  bossFireT=bossTier===3?2200+Math.random()*1000:bossTier===2?1900+Math.random()*900:2400+Math.random()*1400;
  let bx=bossTier===3?bossX:W-.9,by=bossY-.3,dx=hero.x-bx,dy=hero.y-by,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  if(bossTier===2||bossTier===3){
    bossFireballs.push({x:bx,y:by,vx:ux*.00285,vy:uy*.00285,t:3600});
    msg(bossTier===3?"魔王: ファイア！":"強ボス: ファイア！");
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
    if(hero.guard&&(playerClass==="hero"||playerClass==="monk")){
      f.t=0;effects.push({x:f.x,y:f.y,t:220,max:220,type:"hit",color:"#d9f2ff"});msg("ガード！");
      continue;
    }
   f.t=0;knockHero(f.vx>=0?1:-1);
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
 if(!board||!board.length)return;
 const opening=[[0,H-1,0],[1,H-1,0],[2,H-1,1],[2,H-2,1],[5,H-1,2],[5,H-2,2],[6,H-1,3],[7,H-1,3]];
 for(const [x,y,c] of opening)if(x>=0&&x<W&&y>=0&&y<H)board[y][x]=makeSlime(c);
}
function msg(t){let m=document.querySelector("#message");m.textContent=t;if(!gameOver)setTimeout(()=>m.textContent="",850)}
function update(dt){
 heroDiveUpdate(dt);
 monkComboUpdate(dt);
 for(const e of effects)if((e.type==="crescentProjectile"||e.type==="kiProjectile")&&!bossMode){
   e.travel=(e.travel||0)+(e.speed||.012)*dt;
   let px=e.x+e.dx*e.travel,py=e.y+e.dy*e.travel,changed=false,shotRow=Math.max(0,Math.min(H-1,Math.floor(e.y)));
   for(let x=0;x<W;x++)if(board[shotRow][x]){
     let ahead=e.dx>0?x+.5>=e.x:x+.5<=e.x;
     if(ahead&&Math.abs(x+.5-px)<.62){hitEffect(x+.5,shotRow+.5,e.color);board[shotRow][x]=null;changed=true}
   }
   for(const q of pairs)for(const part of [0,1]){
     if((part===0&&q.a==null)||(part===1&&q.b==null))continue;
     let z=pairPos(q,part),ahead=e.dx>0?z.x+.5>=e.x:z.x+.5<=e.x;
     if(ahead&&Math.floor(z.y)===shotRow&&Math.abs(z.x+.5-px)<.62){hitEffect(z.x+.5,z.y+.5,e.color);if(part===0)q.a=null;else q.b=null;changed=true}
   }
   if(changed){gravity();resolve()}
 }
 for(const e of effects)if(e.type==="bossWave"&&!e.hit){
   e.travel=(e.travel||0)+(e.speed||.0085)*dt;
   let px=e.x+e.dx*e.travel,py=e.y+e.dy*e.travel;
   // Destroy slimes only when the visible wave actually reaches them.
   for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&!board[y][x]._waveHit){
     if(Math.hypot(x+.5-px,y+.5-py)<.58){hitEffect(x+.5,y+.5,e.color);board[y][x]=null;e.changed=true}
   }
   for(const q of pairs)for(const part of [0,1]){
     if((part===0&&q.a==null)||(part===1&&q.b==null))continue;let z=pairPos(q,part);
     if(Math.hypot(z.x+.5-px,z.y+.5-py)<.58){hitEffect(z.x+.5,z.y+.5,e.color);if(part===0)q.a=null;else q.b=null;e.changed=true}
   }
   if(e.changed){gravity();resolve();e.changed=false}
   // Damage only when the travelling wave visibly reaches the boss.
   let bx=bossTier===3?bossX:W-.62,by=bossY;
   if(bossMode&&Math.hypot(px-bx,py-by)<1.05){e.hit=true;bossDamage(2,e.isHero?"聖剣波！":e.isMage?"特大ファイアボール！":"気功波！");effects.push({x:px,y:py,t:280,max:280,type:"hit",color:e.color})}
 }
 effects.forEach(e=>e.t-=dt);effects=effects.filter(e=>e.t>0);
 if(gameOver||cleared||!playerClass)return;
 if(cloudMode){updateCloudHero(dt);updateCloudMode(dt);return}
 updateBoss(dt);
 updateEnemies(dt);
 updatePairs(dt);updateHero(dt);updateLiftRide();
 {let lateFast=(stage>=7&&!bossMode);fallSpeed=Math.min(lateFast?.00195:.00145,(lateFast?.00105:.00075)+score/9000000);}
 document.querySelector("#score").textContent=score;
 document.querySelector("#chainPoints").textContent=chainPoints;let gp=document.querySelector("#goalPoints");if(gp)gp.textContent=gameMode==="endless"?"∞":GOAL;
 document.querySelector("#specialText").textContent=Math.floor(special)+"%";
 document.querySelector("#specialBar").style.width=special+"%";
 if(gameMode==="timeAttack"&&!bossMode){modeElapsed+=dt;let mt=document.querySelector("#modeTime");if(mt)mt.textContent=(modeElapsed/1000).toFixed(1)+"秒";}
}

function slime(x,y,s){if(y<-1)return;ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(x+.5,y+.91,.34,.075,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=s.color||"#aeb4bf";ctx.beginPath();ctx.roundRect(x+.055,y+.055,.89,.89,.36);ctx.fill();ctx.fillStyle="rgba(0,0,0,.10)";ctx.beginPath();ctx.roundRect(x+.12,y+.58,.76,.29,.16);ctx.fill();ctx.fillStyle="rgba(255,255,255,.22)";ctx.beginPath();ctx.ellipse(x+.31,y+.25,.17,.10,-.45,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,.48)";ctx.beginPath();ctx.arc(x+.245,y+.205,.045,0,Math.PI*2);ctx.fill();ctx.fillStyle="#202438";ctx.beginPath();ctx.arc(x+.32,y+.42,.055,0,Math.PI*2);ctx.arc(x+.68,y+.42,.055,0,Math.PI*2);ctx.fill();if(s.hard){ctx.strokeStyle="#e7e8f0";ctx.lineWidth=.065;ctx.beginPath();ctx.roundRect(x+.13,y+.13,.74,.64,.25);ctx.stroke()}if(s.frozen){ctx.fillStyle="rgba(190,238,255,.5)";ctx.beginPath();ctx.roundRect(x+.04,y+.04,.92,.9,.25);ctx.fill();ctx.strokeStyle="#e4fbff";ctx.lineWidth=.04;ctx.stroke()}}

function drawBoss(){
 if(!bossMode)return;
 if(bossTier===2||bossTier===3){for(const r of strongLiftRects()){ctx.save();ctx.fillStyle="#536579";ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle="#91a9bd";ctx.fillRect(r.x+.08,r.y+.05,r.w-.16,.08);ctx.strokeStyle="#b9e8ff";ctx.lineWidth=.035;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.restore();}}
 let x=bossTier===3?bossX:W-.62,y=bossY;
 // Permanent three-step stone pedestal: terrain, not slime data.
 if(bossTier===1){ctx.save();for(let step=0;step<3;step++){let bx=W-1-step,h=3-step;for(let yy=H-h;yy<H;yy++){ctx.fillStyle="#596372";ctx.fillRect(bx+.04,yy+.04,.92,.92);ctx.fillStyle="#7c8796";ctx.fillRect(bx+.09,yy+.09,.82,.16);ctx.strokeStyle="#3f4753";ctx.lineWidth=.035;ctx.strokeRect(bx+.04,yy+.04,.92,.92);}}ctx.restore();}
 ctx.save();ctx.translate(x,y);if(bossTier===3){ctx.save();ctx.fillStyle="#e5b94e";ctx.beginPath();ctx.moveTo(-.34,-.76);ctx.lineTo(-.18,-1.05);ctx.lineTo(0,-.79);ctx.lineTo(.2,-1.08);ctx.lineTo(.36,-.74);ctx.closePath();ctx.fill();ctx.restore()}
 let q=bossHitT>0?Math.sin(bossHitT*.08)*.06:0;ctx.scale(1+q,1-q);
 // cloak/body: about two grid cells tall
 ctx.fillStyle=bossTier===3?"#351827":"#39234f";ctx.beginPath();ctx.moveTo(-.46,.72);ctx.lineTo(-.5,-.25);ctx.quadraticCurveTo(-.42,-.72,0,-.82);ctx.quadraticCurveTo(.42,-.72,.5,-.25);ctx.lineTo(.46,.72);ctx.closePath();ctx.fill();
 ctx.fillStyle=bossTier===3?"#9a3045":"#6f3b86";ctx.beginPath();ctx.moveTo(-.36,.62);ctx.lineTo(-.34,-.15);ctx.lineTo(0,.05);ctx.lineTo(.34,-.15);ctx.lineTo(.36,.62);ctx.closePath();ctx.fill();
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
 if(bossTier===3){
  let f=hero.x<x?-1:1,sw=demonSwordFx>0?1-demonSwordFx/300:0;
  let ang=demonSwordFx>0?(-1.15+sw*2.35):-.72;
  let sx=.28*f,sy=-.03,ex=sx+Math.cos(ang)*.82*f,ey=sy+Math.sin(ang)*.82;
  ctx.strokeStyle="#f4e6c0";ctx.lineWidth=.085;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
  ctx.strokeStyle="#d6a94b";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(sx-.09*f,sy-.03);ctx.lineTo(sx+.09*f,sy+.03);ctx.stroke();
  if(demonSwordFx>0){ctx.strokeStyle="rgba(255,220,150,.62)";ctx.lineWidth=.055;ctx.beginPath();ctx.arc(.16*f,-.02,.88,f>0?-1.2:0,f>0?1.15:2.35);ctx.stroke();}
 }
 ctx.restore();
 for(const f of bossFireballs){
  ctx.save();ctx.translate(f.x,f.y);ctx.fillStyle="#ff6a2a";ctx.beginPath();ctx.arc(0,0,.16,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#ffd35a";ctx.beginPath();ctx.arc(-.04,-.02,.08,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}
function drawHero(){
 let x=hero.x,y=hero.y,bob=hero.onGround&&hero.vx?Math.sin(hero.walk)*.035:0,f=hero.face;
 ctx.save();ctx.translate(x,y+bob);if(hero.guard&&(playerClass==="hero"||playerClass==="monk")){ctx.save();ctx.strokeStyle="#d9f2ff";ctx.lineWidth=.07;ctx.beginPath();ctx.arc(f*.34,-.03,.34,f>0?-Math.PI/2:Math.PI/2,f>0?Math.PI/2:Math.PI*1.5);ctx.stroke();ctx.restore()}if(hero.stun>0){ctx.rotate(-.78);ctx.translate(-.08,.18)}
 if(hero.squeezeT>0){let q=Math.sin((hero.squeezeT/320)*Math.PI);if(hero.squeezeDir===2){ctx.scale(1-.42*q,1+.55*q);ctx.translate(0,-.18*q)}else{ctx.scale(1+.42*q,1-.36*q);ctx.translate(-hero.squeezeDir*.12*q,.12*q)}}
 let step=hero.vx?Math.sin(hero.walk)*.12:0,kp=hero.kickT>0?Math.sin((1-hero.kickT/180)*Math.PI):0;

 if(playerClass==="monk"){
   // Original monk: green sleeveless gi, dark green pants, belt/wrist wraps, bare hands, headband.
   ctx.strokeStyle="#7a451d";ctx.lineWidth=.18;ctx.beginPath();
   if(hero.kickT>0){ctx.moveTo(-f*.07,.24);ctx.lineTo(-f*.12,.49);ctx.moveTo(f*.08,.24);ctx.lineTo(f*(.28+.4*kp),.28-.04*kp)}
   else{ctx.moveTo(-.11,.24);ctx.lineTo(-.15+step,.5);ctx.moveTo(.11,.24);ctx.lineTo(.15-step,.5)}ctx.stroke();
   ctx.strokeStyle="#4c3b30";ctx.lineWidth=.13;ctx.beginPath();
   if(hero.kickT>0){ctx.moveTo(-f*.12,.49);ctx.lineTo(-f*.23,.5);let fx=f*(.28+.4*kp),fy=.28-.04*kp;ctx.moveTo(fx,fy);ctx.lineTo(fx+f*.16,fy)}
   else{ctx.moveTo(-.15+step,.5);ctx.lineTo(-.25+step,.51);ctx.moveTo(.15-step,.5);ctx.lineTo(.25-step,.51)}ctx.stroke();
   // Monk: layered emerald gi with cream lapels, sash, shoulder guard and prayer beads.
   ctx.fillStyle="#d97824";ctx.beginPath();ctx.moveTo(-.29,-.2);ctx.lineTo(.29,-.2);ctx.lineTo(.23,.31);ctx.lineTo(-.23,.31);ctx.closePath();ctx.fill();
   ctx.fillStyle="#f0a23a";ctx.beginPath();ctx.moveTo(-.25,-.18);ctx.lineTo(.03,.02);ctx.lineTo(-.06,.25);ctx.lineTo(-.25,.16);ctx.closePath();ctx.fill();
   ctx.fillStyle="#efe2b8";ctx.beginPath();ctx.moveTo(-.13,-.2);ctx.lineTo(.04,.01);ctx.lineTo(.15,-.2);ctx.lineTo(.23,-.17);ctx.lineTo(.05,.11);ctx.lineTo(-.22,-.14);ctx.closePath();ctx.fill();
   ctx.fillStyle="#49337d";ctx.fillRect(-.26,.08,.52,.09);
   ctx.fillStyle="#8f72d8";ctx.fillRect(-.26,.115,.52,.035);
   ctx.fillStyle="#e6c09d";ctx.beginPath();ctx.arc(0,-.39,.25,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#3a2923";ctx.beginPath();ctx.arc(-.02,-.49,.22,Math.PI,Math.PI*2);ctx.fill();
   ctx.fillStyle="#6550a8";ctx.fillRect(-.255,-.49,.51,.06);ctx.beginPath();ctx.moveTo(-f*.2,-.46);ctx.lineTo(-f*.46,-.36);ctx.lineTo(-f*.22,-.34);ctx.fill();
   ctx.fillStyle="#49337d";ctx.beginPath();ctx.arc(-f*.23,-.08,.105,0,Math.PI*2);ctx.fill();
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
   ctx.fillStyle="#233f86";ctx.beginPath();ctx.moveTo(-f*.12,-.18);ctx.lineTo(-f*.42,.38);ctx.lineTo(-f*.08,.3);ctx.closePath();ctx.fill();
   ctx.strokeStyle="#d8dce8";ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(-.11,.25);ctx.lineTo(-.14+step,.48);ctx.moveTo(.11,.25);ctx.lineTo(.14-step,.48);ctx.stroke();
   ctx.strokeStyle="#49382f";ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-.14+step,.48);ctx.lineTo(-.24+step,.49);ctx.moveTo(.14-step,.48);ctx.lineTo(.24-step,.49);ctx.stroke();
   ctx.fillStyle="#315fbd";ctx.beginPath();ctx.moveTo(-.24,-.18);ctx.lineTo(.24,-.18);ctx.lineTo(.21,.3);ctx.lineTo(-.21,.3);ctx.closePath();ctx.fill();
   ctx.fillStyle="#4d83df";ctx.beginPath();ctx.moveTo(-.2,-.17);ctx.lineTo(.03,.02);ctx.lineTo(.2,-.17);ctx.lineTo(.2,.04);ctx.lineTo(.03,.15);ctx.lineTo(-.2,.02);ctx.closePath();ctx.fill();
   ctx.fillStyle="#f0dfb2";ctx.beginPath();ctx.moveTo(-.13,-.18);ctx.lineTo(.02,-.01);ctx.lineTo(.13,-.18);ctx.lineTo(.19,-.14);ctx.lineTo(.03,.09);ctx.lineTo(-.19,-.13);ctx.closePath();ctx.fill();
   ctx.fillStyle="#e5bd4c";ctx.fillRect(-.23,.105,.46,.075);
   ctx.fillStyle="#1f3975";ctx.beginPath();ctx.arc(-f*.22,-.07,.105,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e5bd4c";ctx.lineWidth=.025;ctx.stroke();
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
 if(hero.charge>0){ctx.strokeStyle=playerClass==="monk"?"#8f72d8":"#5c91ee";ctx.lineWidth=.045;ctx.beginPath();ctx.arc(0,0,.57,0,Math.PI*2*hero.charge/100);ctx.stroke()}
 
 if(heroDive.active){
  ctx.save();ctx.strokeStyle="#ffe45c";ctx.lineWidth=.07;ctx.shadowColor="#fff3a0";ctx.shadowBlur=10;
  for(let i=0;i<3;i++){let ox=(i-1)*.13;ctx.beginPath();ctx.moveTo(ox,-.05);ctx.lineTo(ox+.09,.18);ctx.lineTo(ox-.05,.40);ctx.lineTo(ox+.06,.68);ctx.stroke()}
  ctx.restore()
 }
ctx.restore();
}
function drawCloudClimb(){
 if(!cloudMode)return;
 ctx.save();
 for(const c of cloudPlatforms){let sy=H-c.y-1;if(sy<-1||sy>H+1)continue;ctx.fillStyle=c.fill||"rgba(245,250,255,.92)";ctx.beginPath();ctx.roundRect(c.x,sy,c.w,.42,.22);ctx.fill();ctx.fillStyle=c.shade||"rgba(185,220,245,.55)";ctx.beginPath();ctx.ellipse(c.x+.5,sy+.08,.49,.3,0,0,Math.PI*2);ctx.ellipse(c.x+1.5,sy+.08,.49,.3,0,0,Math.PI*2);ctx.fill();
 // Two cloud slimes joined side-by-side: each slime has two eyes.
 ctx.fillStyle="#315170";for(const ex of [c.x+.34,c.x+.62,c.x+1.34,c.x+1.62]){ctx.beginPath();ctx.arc(ex,sy+.12,.042,0,Math.PI*2);ctx.fill()}
 ctx.strokeStyle="rgba(70,100,125,.65)";ctx.lineWidth=.022;for(const mx of [c.x+.5,c.x+1.5]){ctx.beginPath();ctx.arc(mx,sy+.19,.105,.15,2.8);ctx.stroke()}
if(c.goal){ctx.fillStyle="#8b5a2b";ctx.fillRect(c.x+c.w/2-.06,sy-.92,.12,.78);ctx.fillStyle="#fff4c8";ctx.strokeStyle="#8b5a2b";ctx.lineWidth=.05;ctx.fillRect(c.x+c.w/2-.72,sy-1.28,1.44,.48);ctx.strokeRect(c.x+c.w/2-.72,sy-1.28,1.44,.48);ctx.fillStyle="#7a351d";ctx.font="bold .25px sans-serif";ctx.textAlign="center";ctx.fillText("GOAL",c.x+c.w/2,sy-.96)}
else if(c.motion==="side"){ctx.fillStyle="rgba(50,80,110,.5)";ctx.font="bold .18px sans-serif";ctx.textAlign="center";ctx.fillText(c.vx>0?"→":"←",c.x+1,sy+.36)}
else if(c.motion==="up"){ctx.fillStyle="rgba(50,80,110,.5)";ctx.font="bold .18px sans-serif";ctx.textAlign="center";ctx.fillText("↑",c.x+1,sy+.36)}}
 for(const k of cloudCannons){let sy=H-k.y-1;if(sy<-1||sy>H+1)continue;ctx.fillStyle="#33283f";ctx.fillRect(k.x-.22,sy-.18,.44,.36);ctx.strokeStyle="#9a6bca";ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(k.x,sy);ctx.lineTo(k.x+(k.x<W/2?.48:-.48),sy);ctx.stroke()}
 for(const s of cloudShots){ctx.fillStyle="#b04cff";ctx.beginPath();ctx.arc(s.x,s.y,.16,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(235,160,255,.65)";ctx.lineWidth=.06;ctx.beginPath();ctx.arc(s.x,s.y,.25,0,Math.PI*2);ctx.stroke()}
 ctx.fillStyle="rgba(20,30,55,.75)";ctx.font=".34px sans-serif";ctx.fillText("☁ "+Math.floor(cloudY)+" / "+cloudGoal, .25,.55);
 ctx.restore();
}
function drawEffects(){
 for(const e of effects){
   let p=1-e.t/e.max,alpha=e.t/e.max;
   ctx.save();ctx.globalAlpha=alpha;
   if(e.type==="hit"){
     ctx.strokeStyle="#fff6b0";ctx.lineWidth=.06;
     for(let i=0;i<6;i++){let a=i*Math.PI/3,r=.12+p*.32;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*.05,e.y+Math.sin(a)*.05);ctx.lineTo(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);ctx.stroke()}
   }else if(e.type==="bossWave"){
     let px=e.x+e.dx*(e.travel||0),py=e.y+e.dy*(e.travel||0),ang=Math.atan2(e.dy||0,e.dx||1);
     if(e.isHero){ctx.translate(px,py);ctx.rotate(ang);ctx.strokeStyle=e.color;ctx.lineWidth=.15;ctx.beginPath();ctx.arc(0,0,.4,-1.15,1.15);ctx.stroke();ctx.strokeStyle="rgba(255,175,175,.6)";ctx.lineWidth=.065;ctx.beginPath();ctx.arc(-.08,0,.52,-1.05,1.05);ctx.stroke()}
     else if(e.isMage){ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(px,py,.38,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(255,220,140,.82)";ctx.lineWidth=.09;ctx.beginPath();ctx.arc(px,py,.52,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="rgba(255,120,40,.55)";ctx.lineWidth=.08;ctx.beginPath();ctx.moveTo(px-e.dx*.72,py-e.dy*.72);ctx.lineTo(px-e.dx*.28,py-e.dy*.28);ctx.stroke()}
     else{ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(px,py,.24,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(230,255,235,.75)";ctx.lineWidth=.07;ctx.beginPath();ctx.arc(px,py,.34,0,Math.PI*2);ctx.stroke()}
   }else if(e.type==="kiProjectile"){
   let px=e.x+(e.dx||0)*(e.travel||0),py=e.y+(e.dy||0)*(e.travel||0);
   ctx.fillStyle=e.color||"#9dffb0";ctx.beginPath();ctx.arc(px,py,.25,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="rgba(230,255,235,.78)";ctx.lineWidth=.07;ctx.beginPath();ctx.arc(px,py,.36,0,Math.PI*2);ctx.stroke();
  }else if(e.type==="giantFireProjectile"){
   let q=1-e.t/e.max,px=e.x+(e.dx||0)*q*10,py=e.y+(e.dy||0)*q*10;
   ctx.fillStyle=e.color||"#ff7a22";ctx.beginPath();ctx.arc(px,py,.39,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="rgba(255,220,140,.85)";ctx.lineWidth=.09;ctx.beginPath();ctx.arc(px,py,.53,0,Math.PI*2);ctx.stroke();
   ctx.strokeStyle="rgba(255,120,40,.58)";ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(px-(e.dx||0)*.72,py-(e.dy||0)*.72);ctx.lineTo(px-(e.dx||0)*.3,py-(e.dy||0)*.3);ctx.stroke();
  }else if(e.type==="crescentProjectile"){
   let px=e.x+(e.dx||0)*(e.travel||0),py=e.y+(e.dy||0)*(e.travel||0),ang=Math.atan2(e.dy||0,e.dx||1);
   ctx.save();ctx.translate(px,py);ctx.rotate(ang);ctx.strokeStyle=e.color||"#ff334f";ctx.lineWidth=.14;ctx.beginPath();ctx.arc(0,0,.38,-1.15,1.15);ctx.stroke();ctx.strokeStyle="rgba(255,170,170,.55)";ctx.lineWidth=.06;ctx.beginPath();ctx.arc(-.08,0,.5,-1.05,1.05);ctx.stroke();ctx.restore();
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
 if(cloudMode){
 ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.scale(S,S);
 let bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#6f9ed0");bg.addColorStop(.58,"#4f79a7");bg.addColorStop(1,"#365978");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.fillStyle="rgba(240,248,255,.09)";for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(.8+i*1.45,1.5+(i%3)*2.5,.7,0,Math.PI*2);ctx.fill()}
 drawCloudClimb();drawHero();drawEffects();ctx.restore();return
}

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
 drawBoss();drawEnemies();drawEffects();drawHero();if(hero.carry)slime(hero.x+hero.face*.42-.5,hero.y-.95,hero.carry);ctx.restore();
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
function setModeHud(){
 let mt=document.querySelector("#modeText"),tm=document.querySelector("#modeTime"),ex=document.querySelector("#modeExitBtn");
 if(mt)mt.textContent=gameMode==="timeAttack"?"TIME ATTACK":gameMode==="endless"?"ひたすら":"";
 if(tm)tm.textContent=gameMode==="timeAttack"?"0.0秒":"";
 if(ex)ex.style.display=gameMode==="campaign"?"none":"inline-block";
}
window.beginSpecialMode=function(job,mode){
 if(job!=="hero"&&job!=="monk"&&job!=="mage")return;
 gameMode=mode;modeElapsed=0;bossOnlyRun=false;selectedClass=job;playerClass=job;
 stage=1;bossMode=false;GOAL=mode==="timeAttack"?20:0;enemies=[];enemySpawnT=999999;
 resetStageBoard();seedOpeningBoard();spawnClock=0;
 hero.grab=null;hero.carry=null;hero.guard=false;hero.stun=0;hero.vx=0;hero.vy=0;hero.liftRide=-1;
 hero.floating=(job==="mage");hero.x=W/2;hero.y=job==="mage"?H-4.0:H-1.2;hero.onGround=(job!=="mage");
 setActionLabels();setModeHud();updateStageHud();draw();
 let cn=document.querySelector("#className");if(cn)cn.textContent="職業: "+(job==="hero"?"勇者（青・紅蓮斬）":job==="monk"?"モンク（黄橙・翠気功波）":"魔法使い（青・蒼氷解放）");
};
window.beginSelectedJob=function(job){
 if(job!=="hero"&&job!=="monk"&&job!=="mage")return;
 gameMode="campaign";modeElapsed=0;setModeHud();bossOnlyRun=false;selectedClass=job;playerClass=job;
 resetStageBoard();
 stage=1;bossMode=false;GOAL=12;enemies=[];enemySpawnT=999999;
 seedOpeningBoard();spawnClock=0;
 hero.grab=null;hero.carry=null;hero.guard=false;hero.stun=0;hero.vx=0;hero.vy=0;hero.liftRide=-1;
 hero.floating=(job==="mage");
 hero.x=W/2;hero.y=job==="mage"?H-4.0:H-1.2;hero.onGround=(job!=="mage");
 setActionLabels();updateStageHud();
 draw();
 let cn=document.querySelector("#className");
 if(cn)cn.textContent="職業: "+(job==="hero"?"勇者（青・紅蓮斬）":job==="monk"?"モンク（黄橙・翠気功波）":"魔法使い（青・蒼氷解放）");
};

document.querySelector("#modeExitBtn")?.addEventListener("click",()=>{
 gameOver=true;cleared=true;
 let result=document.querySelector("#stageResult"),info=document.querySelector("#stageInfo");
 if(result)result.textContent=gameMode==="endless"?"ひたすら終了":"TIME ATTACK終了";
 if(info)info.textContent=gameMode==="endless"?`最終ポイント ${chainPoints}`:`${chainPoints}ポイント / ${(modeElapsed/1000).toFixed(2)}秒`;
 document.querySelector("#nextStageBtn").style.display="none";document.querySelector("#continueBtn").style.display="none";
 document.querySelector("#stageMenu").style.display="flex";
});
document.querySelector("#nextStageBtn")?.addEventListener("click",()=>{
 document.querySelector("#stageMenu").style.display="none";
 if(bossMode){
  let strongCleared=false,demonCleared=false;try{strongCleared=localStorage.getItem("osekkaiStrongBossCleared")==="1";demonCleared=localStorage.getItem("osekkaiDemonCleared")==="1"}catch(e){}
  if(bossOnlyRun&&bossTier===1&&strongCleared){startBossStage(2);bossOnlyRun=true}
  else if(bossOnlyRun&&bossTier===2&&demonCleared){startBossStage(3);bossOnlyRun=true}
  else if(bossOnlyRun){bossOnlyRun=false;startNormalStage(1)}
  else{startNormalStage(bossTier===1?4:bossTier===2?7:1)}
}else if(stage===3){
  startBossStage(1)
}else if(stage===6){
  startBossStage(2)
}else if(stage===9){
  startBossStage(3)
}else{
  startNormalStage(stage+1)
}
});
document.querySelector("#continueBtn")?.addEventListener("click",()=>{
 document.querySelector("#stageMenu").style.display="none";
 if(bossMode)startBossStage();else startNormalStage(stage);
});
document.querySelector("#titleBtn")?.addEventListener("click",()=>{
 document.querySelector("#stageMenu").style.display="none";gameMode="campaign";modeElapsed=0;setModeHud();bossMode=false;stage=1;GOAL=12;resetStageBoard();updateStageHud();
 selectedClass=null;playerClass=null;window.pendingClass=null;document.querySelector("#classSelect").style.display="flex";
 document.querySelectorAll(".classBtn").forEach(x=>x.classList.remove("selected"));
 document.querySelector("#startBtn").disabled=true;document.querySelector("#classHelp").textContent="職業をタップすると操作説明が表示されます。";
});
function heroGrabDirection(dir){
 if(playerClass!=="hero"||!hero.grab)return false;
 if(dir==="up"){nextHeroGrabColor(1);return true}
 if(dir==="down"){nextHeroGrabColor(-1);return true}
 return false;
}
const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",z:"jump",x:"attack",c:"grab",k:"kick"};
addEventListener("keydown",e=>{let k=map[e.key];if(!k)return;e.preventDefault();
 if(!e.repeat&&["left","right","up","down"].includes(k)){if(playerClass==="mage"&&(k==="left"||k==="right"))hero.face=k==="left"?-1:1}
 if(!e.repeat&&heroGrabDirection(k)){keys[k]=false;return}keys[k]=true;if(k==="jump"&&!e.repeat)jump();if(k==="grab"&&!e.repeat)grab();if(k==="kick"&&!e.repeat)kick();});
addEventListener("keyup",e=>{let k=map[e.key];if(!k)return;e.preventDefault();if(k==="attack")attack();keys[k]=false;if(k==="grab"){hero.grabHold=0;hero.grabColorTick=0;hero.guard=false}});
const fastFallBtn=document.querySelector("#fastFall");
if(fastFallBtn){
 const setFast=v=>{fastFall=v;fastFallBtn.classList.toggle("active",v);fastFallBtn.innerHTML=v?"▶▶<small>高速 ON</small>":"▼▼<small>早送り</small>"};
 fastFallBtn.addEventListener("pointerdown",e=>{e.preventDefault();setFast(!fastFall)},{passive:false});
}
const moveStick=document.querySelector("#moveStick"),stickKnob=document.querySelector("#stickKnob");if(moveStick&&stickKnob){let sid=null,sdir=null;const clear=()=>{if(sdir)keys[sdir]=false;sdir=null;sid=null;stickKnob.style.transform="translate(0px,0px)"};const set=e=>{let r=moveStick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),mx=r.width*.28;if(d>mx){dx=dx/d*mx;dy=dy/d*mx}stickKnob.style.transform=`translate(${dx}px,${dy}px)`;let next=d<r.width*.1?null:(Math.abs(dx)>=Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down"));if(next!==sdir){if(sdir)keys[sdir]=false;sdir=next;if(next){if(heroGrabDirection(next)){keys[next]=false}else{keys[next]=true}if(playerClass==="mage"&&(next==="left"||next==="right"))hero.face=next==="left"?-1:1}}};moveStick.addEventListener("pointerdown",e=>{e.preventDefault();sid=e.pointerId;try{moveStick.setPointerCapture(sid)}catch(_){}set(e)});moveStick.addEventListener("pointermove",e=>{if(e.pointerId===sid){e.preventDefault();set(e)}});moveStick.addEventListener("pointerup",e=>{if(e.pointerId===sid)clear()});moveStick.addEventListener("pointercancel",clear)}
document.querySelectorAll("button[data-key]").forEach(b=>{let k=b.dataset.key;const down=e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch(_){}
 if(["left","right","up","down"].includes(k)){if(playerClass==="mage"&&(k==="left"||k==="right"))hero.face=k==="left"?-1:1}
 if(heroGrabDirection(k)){keys[k]=false;return}keys[k]=true;b.classList.add("pressed");if(k==="jump")jump();if(k==="grab")grab();if(k==="kick")kick();};const up=e=>{e.preventDefault();if(k==="attack"&&keys[k])attack();keys[k]=false;if(k==="grab"){hero.grabHold=0;hero.grabColorTick=0}b.classList.remove("pressed");try{if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId)}catch(_){}};b.addEventListener("pointerdown",down,{passive:false});b.addEventListener("pointerup",up,{passive:false});b.addEventListener("pointercancel",up,{passive:false});});



window.startCloudClimb=startCloudClimb;
window.beginCloudMode=function(job){
 if(job==="mage"){msg("魔法使いは雲登り不可！");return}
 if(typeof window.beginSelectedJob==="function"){window.beginSelectedJob(job)}
 else {playerClass=job}
 setTimeout(()=>startCloudClimb(),0);
};
