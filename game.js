const cv=document.querySelector("#game"),ctx=cv.getContext("2d");
const W=8,H=14,S=45,COLORS=["#59dc76","#ff5f78","#43aef5","#ffd85c"];
let board=Array.from({length:H},()=>Array(W).fill(null)),score=0,special=0,chain=0,gameOver=false;
const hero={x:3.5,y:H-1.55,vx:0,vy:0,w:.52,h:.92,onGround:false,grab:null,stun:0,charge:0,face:1,walk:0,attackT:0,attackDir:"right",attackPower:1};
let pairs=[],pairSeq=0,spawnClock=0,keys={},last=performance.now(),fallSpeed=.00075;

function makeSlime(type,hard=false){return{color:COLORS[type],hp:hard?4:2,hard}}
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
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&!vis[y][x]){
  let q=[[x,y]],g=[],col=board[y][x].color;vis[y][x]=true;
  while(q.length){let [cx,cy]=q.pop();g.push([cx,cy]);for(const[dX,dY]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=cx+dX,ny=cy+dY;if(nx>=0&&nx<W&&ny>=0&&ny<H&&!vis[ny][nx]&&board[ny][nx]?.color===col){vis[ny][nx]=true;q.push([nx,ny])}}}
  if(g.length>=4)groups.push(g);
 }
 if(!groups.length){chain=0;document.querySelector("#chain").textContent=0;return}
 chain++;document.querySelector("#chain").textContent=chain;
 groups.flat().forEach(([x,y])=>{board[y][x]=null;score+=10*chain;special=Math.min(100,special+3*chain)});
 setTimeout(()=>{gravity();resolve()},160);
}
function gravity(){for(let x=0;x<W;x++){let v=[];for(let y=H-1;y>=0;y--)if(board[y][x])v.push(board[y][x]);for(let y=H-1,i=0;y>=0;y--)board[y][x]=i<v.length?v[i++]:null}}
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
function updateHero(dt){
 if(hero.stun>0){hero.stun-=dt;return}
 if(hero.attackT>0)hero.attackT=Math.max(0,hero.attackT-dt);

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
   if(ph.r.b<=heroTop+.28 || (ph.p.y+ph.part)<hero.y-.2){
     let escape=hero.x<(ph.p.x+.5)?-1:1;
     let tryX=hero.x+escape*.72;
     if(solidAt(tryX,hero.y))escape*=-1;
     hero.x=Math.max(.3,Math.min(W-.3,hero.x+escape*.62));
     hero.vy=-.0038;hero.stun=420;hero.grab=null;msg("いてっ！");
   }else if(hero.vy>0){hero.y=ph.r.t-hero.h/2;hero.vy=0;hero.onGround=true}
   else if(hero.vy<0){hero.y=ph.r.b+hero.h/2;hero.vy=.0015}
 }else if(hero.vy>=0&&solidAt(hero.x,ny+hero.h/2)){
   hero.vy=0;hero.y=Math.floor(ny+hero.h/2)-hero.h/2;hero.onGround=true;
 }else if(hero.vy<0&&solidAt(hero.x,ny-hero.h/2)){hero.vy=.002}else hero.y=ny;
 if(hero.y>H){hero.y=H-1.5;hero.vy=0}
 if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
}
function jump(){
 if(hero.onGround||hero.grab){
   if(hero.grab?.kind==="pair")hero.grab=null;
   hero.vy=-.0115;
   if(hero.grab?.kind==="board")hero.grab=null;
 }
}
function attack(){
 let power=hero.charge>=75?4:1;hero.charge=0;
 let dx=hero.face,dy=0,dir=hero.face>0?"right":"left";
 if(keys.up){dx=0;dy=-1;dir="up"}else if(keys.down){dx=0;dy=1;dir="down"}
 hero.attackDir=dir;hero.attackPower=power;hero.attackT=150;

 // Precise thrust: narrow line, 1 cell normally / 2 cells when charged.
 let reach=power>=4?2.05:1.15;
 let hx=hero.x,hy=hero.y;
 // Falling slimes get priority if they lie on the thrust line.
 for(const p of pairs){
   for(const part of [0,1]){
     if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
     let px=p.x+.5,py=p.y+part+.5;
     let along=(px-hx)*dx+(py-hy)*dy,perp=Math.abs((px-hx)*(-dy)+(py-hy)*dx);
     if(along>0&&along<=reach&&perp<.42){
       let key=part===0?"hpA":"hpB";p[key]-=power;
       if(p[key]<=0){if(part===0)p.a=null;else p.b=null;score+=5;msg("空中撃破！");if(p.a==null&&p.b==null)pairs=pairs.filter(q=>q!==p)}
       return;
     }
   }
 }
 for(let r=.55;r<=reach;r+=.45){
   let tx=Math.floor(hx+dx*r),ty=Math.floor(hy+dy*r);
   if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){
     board[ty][tx].hp-=power;
     if(board[ty][tx].hp<=0){board[ty][tx]=null;score+=5;gravity();resolve()}
     return;
   }
 }
}
function grab(){
 if(hero.grab){hero.grab=null;msg("パッ");return}
 // Falling slimes can be caught in mid-air if close enough.
 let best=null;
 for(const p of pairs)for(const part of [0,1]){
   if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
   let px=p.x+.5,py=p.y+part+.5,d=Math.hypot(px-hero.x,py-hero.y);
   if(d<1.25&&(!best||d<best.d))best={p,part,d};
 }
 if(best){let side=hero.x<best.p.x+.5?-1:1;hero.grab={kind:"pair",id:best.p.id,part:best.part,side};hero.vy=0;msg("ガシッ！");return}
 let cx=Math.floor(hero.x),cy=Math.floor(hero.y),candidates=[[cx+hero.face,cy],[cx,cy-1],[cx,cy],[cx-hero.face,cy],[cx,cy+1]];
 for(const [x,y] of candidates)if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){
   let side=hero.x<x+.5?-1:1;hero.grab={kind:"board",x,y,side};hero.vx=0;hero.vy=0;hero.x=x+.5+side*.52;hero.y=y+.18;msg("ガシッ！");return;
 }
}
function kick(){
 let dir=hero.face,hy=Math.floor(hero.y);
 // Kick a falling slime sideways one column, even while airborne.
 let target=null,best=9;
 for(const p of pairs)for(const part of [0,1]){
   if((part===0&&p.a==null)||(part===1&&p.b==null))continue;
   let d=Math.hypot((p.x+.5)-hero.x,(p.y+part+.5)-hero.y);
   if(d<1.18&&d<best){target=p;best=d}
 }
 if(target){
   let nx=target.x+dir;
   if(nx>=0&&nx<W&&!board[Math.max(0,Math.floor(target.y+1))]?.[nx]){
     target.x=nx;msg("キック！");return;
   }
 }
 // Settled slime: only if nothing is stacked on top. It moves exactly one cell.
 let tx=Math.floor(hero.x+dir*.8),ty=hy;
 if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]&&!board[ty-1]?.[tx]){
   let nx=tx+dir;if(nx>=0&&nx<W&&!board[ty][nx]){
     board[ty][nx]=board[ty][tx];board[ty][tx]=null;
     gravity();resolve();msg("キック！");
   }
 }
}
function doSpecial(){if(special<100)return;special=0;let cx=Math.floor(hero.x),cy=Math.floor(hero.y),a=[];for(let d=-2;d<=2;d++)a.push([cx+d,cy],[cx,cy+d]);for(const[dX,dY]of[[-1,-1],[1,-1],[-1,1],[1,1]])a.push([cx+dX,cy+dY]);a.forEach(([x,y])=>{if(x>=0&&x<W&&y>=0&&y<H)board[y][x]=null});gravity();resolve();msg("おせっかい十字斬り！")}
function msg(t){let m=document.querySelector("#message");m.textContent=t;if(!gameOver)setTimeout(()=>m.textContent="",850)}
function update(dt){if(gameOver)return;updatePairs(dt);updateHero(dt);fallSpeed=Math.min(.00145,.00075+score/9000000);document.querySelector("#score").textContent=score;document.querySelector("#specialText").textContent=Math.floor(special)+"%";document.querySelector("#specialBar").style.width=special+"%"}

function slime(x,y,s){if(y<-1)return;ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(x+.055,y+.055,.89,.89,.36);ctx.fill();ctx.fillStyle="#202438";ctx.beginPath();ctx.arc(x+.32,y+.42,.055,0,Math.PI*2);ctx.arc(x+.68,y+.42,.055,0,Math.PI*2);ctx.fill();if(s.hard){ctx.strokeStyle="#e7e8f0";ctx.lineWidth=.065;ctx.beginPath();ctx.roundRect(x+.13,y+.13,.74,.64,.25);ctx.stroke()}}
function drawHero(){
 let x=hero.x,y=hero.y,bob=hero.onGround&&hero.vx?Math.sin(hero.walk)*.035:0,f=hero.face;
 ctx.save();ctx.translate(x,y+bob);
 ctx.fillStyle="#b83e55";ctx.beginPath();ctx.moveTo(-f*.12,-.18);ctx.lineTo(-f*.42,.38);ctx.lineTo(-f*.08,.3);ctx.closePath();ctx.fill();
 let step=hero.vx?Math.sin(hero.walk)*.12:0;ctx.strokeStyle="#d8dce8";ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(-.11,.25);ctx.lineTo(-.14+step,.48);ctx.moveTo(.11,.25);ctx.lineTo(.14-step,.48);ctx.stroke();
 ctx.strokeStyle="#49382f";ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-.14+step,.48);ctx.lineTo(-.24+step,.49);ctx.moveTo(.14-step,.48);ctx.lineTo(.24-step,.49);ctx.stroke();
 ctx.fillStyle="#4e78d5";ctx.fillRect(-.23,-.18,.46,.48);ctx.fillStyle="#d9b84c";ctx.fillRect(-.23,.11,.46,.07);
 ctx.fillStyle="#f0c6a2";ctx.beginPath();ctx.arc(0,-.38,.25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#5b3a2a";ctx.beginPath();ctx.arc(-.03,-.47,.23,Math.PI,Math.PI*2);ctx.lineTo(.2,-.4);ctx.lineTo(.08,-.5);ctx.lineTo(-.02,-.39);ctx.lineTo(-.12,-.51);ctx.lineTo(-.24,-.4);ctx.fill();
 ctx.fillStyle="#222";ctx.fillRect(f*.08-.025,-.4,.05,.055);

 // Sword pose: attacks are thrusts, not swings, for precise targeting.
 let dx=f,dy=0;if(hero.attackDir==="up"){dx=0;dy=-1}else if(hero.attackDir==="down"){dx=0;dy=1}else if(hero.attackDir==="left"){dx=-1;dy=0}else if(hero.attackDir==="right"){dx=1;dy=0}
 let thrust=hero.attackT>0 ? Math.sin((1-hero.attackT/150)*Math.PI)*.55 : 0;
 let baseX=f*.25,baseY=-.02, handX=baseX+dx*thrust*.45,handY=baseY+dy*thrust*.45;
 ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(f*.15,-.06);ctx.lineTo(handX,handY);ctx.stroke();
 let bladeLen=.46+thrust*.62;
 let tipx=handX+dx*bladeLen,tipy=handY+dy*bladeLen;
 // Tapered blade with an actual point.
 let px=-dy,py=dx,bladeHalf=.065,neckX=handX+dx*.08,neckY=handY+dy*.08;
 ctx.fillStyle="#edf2ff";ctx.beginPath();
 ctx.moveTo(neckX+px*bladeHalf,neckY+py*bladeHalf);
 ctx.lineTo(tipx,tipy);
 ctx.lineTo(neckX-px*bladeHalf,neckY-py*bladeHalf);
 ctx.closePath();ctx.fill();
 ctx.strokeStyle="#cda64b";ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(handX-dy*.12,handY+dx*.12);ctx.lineTo(handX+dy*.12,handY-dx*.12);ctx.stroke();
 if(hero.attackT>0){
   ctx.strokeStyle="rgba(255,245,185,.75)";ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(handX+dx*.25,handY+dy*.25);ctx.lineTo(tipx+dx*.18,tipy+dy*.18);ctx.stroke();
 }
 if(hero.grab){
   ctx.strokeStyle="#ffe071";ctx.lineWidth=.055;ctx.setLineDash([.08,.06]);ctx.beginPath();ctx.moveTo(0,-.15);
   if(hero.grab.kind==="pair"&&getPair(hero.grab.id)){let gp=getPair(hero.grab.id),py=gp.y+hero.grab.part+.5;ctx.lineTo(gp.x+.5-hero.x,py-hero.y)}
   else ctx.lineTo(0,-.78);
   ctx.stroke();ctx.setLineDash([]);
 }
 if(hero.charge>0){ctx.strokeStyle="#fff";ctx.lineWidth=.045;ctx.beginPath();ctx.arc(0,0,.57,0,Math.PI*2*hero.charge/100);ctx.stroke()}
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.scale(S,S);
 ctx.strokeStyle="#34394f";ctx.lineWidth=.025;for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])slime(x,y,board[y][x]);
 for(const p of pairs){if(p.a!=null)slime(p.x,p.y,makeSlime(p.a));if(p.b!=null)slime(p.x,p.y+1,makeSlime(p.b))}
 drawHero();ctx.restore();
}
function loop(t){let dt=Math.min(32,t-last);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",z:"jump",x:"attack",c:"grab",k:"kick",v:"special"};
addEventListener("keydown",e=>{let k=map[e.key];if(!k)return;e.preventDefault();keys[k]=true;if(k==="jump"&&!e.repeat)jump();if(k==="grab"&&!e.repeat)grab();if(k==="kick"&&!e.repeat)kick();if(k==="special"&&!e.repeat)doSpecial()});
addEventListener("keyup",e=>{let k=map[e.key];if(!k)return;e.preventDefault();if(k==="attack")attack();keys[k]=false});
document.querySelectorAll("button").forEach(b=>{let k=b.dataset.key;const down=e=>{e.preventDefault();keys[k]=true;b.classList.add("pressed");if(k==="jump")jump();if(k==="grab")grab();if(k==="kick")kick();if(k==="special")doSpecial()};const up=e=>{e.preventDefault();if(k==="attack")attack();keys[k]=false;b.classList.remove("pressed")};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up)});
