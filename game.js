const cv=document.querySelector("#game"),ctx=cv.getContext("2d");
const W=8,H=14,S=45,COLORS=["#59dc76","#ff5f78","#43aef5","#ffd85c"];
let board=Array.from({length:H},()=>Array(W).fill(null)),score=0,special=0,chain=0,gameOver=false;
const hero={x:3.5,y:H-1.55,vx:0,vy:0,w:.52,h:.92,onGround:false,grab:null,stun:0,charge:0,face:1,walk:0};
let pair=null,keys={},last=performance.now(),fallSpeed=.00075;

function makeSlime(type,hard=false){return{color:COLORS[type],hp:hard?4:2,hard}}
function topFree(x){for(let y=0;y<H;y++)if(board[y][x])return y-1;return H-1}
function chooseColumn(type){
 let sc=Array(W).fill(0).map((_,x)=>{let y=topFree(x),s=Math.random()*1.8;if(y>=0){
  for(const [dx,dy] of [[-1,0],[1,0],[0,1]]){let nx=x+dx,ny=y+dy;if(nx>=0&&nx<W&&ny<H&&board[ny]?.[nx]?.color===COLORS[type])s+=2.4}
  s-=Math.max(0,5-y)*.6;}return s});
 return Math.random()<.28?Math.floor(Math.random()*W):sc.indexOf(Math.max(...sc));
}
function spawnPair(){let a=Math.floor(Math.random()*4),b=Math.floor(Math.random()*4);pair={x:chooseColumn(a),y:-1.8,a,b}}
function blocked(x,y){let iy=Math.floor(y+.5);return iy>=H||(iy>=0&&board[iy][x])}
function updatePair(dt){
 if(!pair)spawnPair();
 let next=pair.y+fallSpeed*dt;
 // vertical 2-piece: bottom slime is y+1
 if(blocked(pair.x,next+1)){settlePair()}else pair.y=next;
}
function settlePair(){
 let x=pair.x,y=topFree(x);if(y<1){gameOver=true;msg("GAME OVER");return}
 let hardChance=score>700?Math.min(.25,.06+score/9000):0;
 board[y][x]=makeSlime(pair.a,Math.random()<hardChance);
 board[y-1][x]=makeSlime(pair.b,Math.random()<hardChance);
 pair=null;resolve();
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
function updateHero(dt){
 if(hero.stun>0){hero.stun-=dt;return}
 hero.vx=0;if(keys.left){hero.vx=-.0042*dt;hero.face=-1}if(keys.right){hero.vx=.0042*dt;hero.face=1}
 if(hero.vx)hero.walk+=dt*.02;
 let nx=Math.max(.28,Math.min(W-.28,hero.x+hero.vx));
 if(!solidAt(nx,hero.y))hero.x=nx;
 hero.vy+=.000027*dt;let ny=hero.y+hero.vy*dt;hero.onGround=false;
 if(hero.vy>=0&&solidAt(hero.x,ny+hero.h/2)){hero.vy=0;hero.y=Math.floor(ny+hero.h/2)-hero.h/2;hero.onGround=true}else if(hero.vy<0&&solidAt(hero.x,ny-hero.h/2)){hero.vy=.002}else hero.y=ny;
 if(hero.y>H){hero.y=H-1.5;hero.vy=0}
 if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
}
function jump(){if(hero.onGround||hero.grab){hero.vy=-.0115;hero.grab=null}}
function attack(){
 let power=hero.charge>=75?4:1;hero.charge=0,dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}else if(keys.down){dx=0;dy=1}
 let tx=Math.floor(hero.x+dx*.8),ty=Math.floor(hero.y+dy*.85);
 if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){board[ty][tx].hp-=power;if(board[ty][tx].hp<=0){board[ty][tx]=null;score+=5;gravity();resolve()}}
}
function grab(){if(hero.grab){hero.grab=null;return}for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let x=Math.floor(hero.x)+dx,y=Math.floor(hero.y)+dy;if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){hero.grab={x,y};hero.vy=0;return}}}
function doSpecial(){if(special<100)return;special=0;let cx=Math.floor(hero.x),cy=Math.floor(hero.y),a=[];for(let d=-2;d<=2;d++)a.push([cx+d,cy],[cx,cy+d]);for(const[dX,dY]of[[-1,-1],[1,-1],[-1,1],[1,1]])a.push([cx+dX,cy+dY]);a.forEach(([x,y])=>{if(x>=0&&x<W&&y>=0&&y<H)board[y][x]=null});gravity();resolve();msg("おせっかい十字斬り！")}
function msg(t){let m=document.querySelector("#message");m.textContent=t;if(!gameOver)setTimeout(()=>m.textContent="",850)}
function update(dt){if(gameOver)return;updatePair(dt);updateHero(dt);fallSpeed=Math.min(.00145,.00075+score/9000000);document.querySelector("#score").textContent=score;document.querySelector("#specialText").textContent=Math.floor(special)+"%";document.querySelector("#specialBar").style.width=special+"%"}

function slime(x,y,s){if(y<-1)return;ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(x+.06,y+.08,.88,.84,.25);ctx.fill();ctx.fillStyle="#202438";ctx.fillRect(x+.27,y+.37,.1,.1);ctx.fillRect(x+.63,y+.37,.1,.1);if(s.hard){ctx.strokeStyle="#e7e8f0";ctx.lineWidth=.07;ctx.strokeRect(x+.14,y+.15,.72,.55)}}
function drawHero(){
 let x=hero.x,y=hero.y,bob=hero.onGround&&hero.vx?Math.sin(hero.walk)*.035:0, f=hero.face;
 ctx.save();ctx.translate(x,y+bob);
 // cape
 ctx.fillStyle="#b83e55";ctx.beginPath();ctx.moveTo(-f*.12,-.18);ctx.lineTo(-f*.42,.38);ctx.lineTo(-f*.08,.3);ctx.closePath();ctx.fill();
 // legs + boots
 let step=hero.vx?Math.sin(hero.walk)*.12:0;ctx.strokeStyle="#d8dce8";ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(-.11,.25);ctx.lineTo(-.14+step,.48);ctx.moveTo(.11,.25);ctx.lineTo(.14-step,.48);ctx.stroke();
 ctx.strokeStyle="#49382f";ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-.14+step,.48);ctx.lineTo(-.24+step,.49);ctx.moveTo(.14-step,.48);ctx.lineTo(.24-step,.49);ctx.stroke();
 // torso
 ctx.fillStyle="#4e78d5";ctx.fillRect(-.23,-.18,.46,.48);ctx.fillStyle="#d9b84c";ctx.fillRect(-.23,.11,.46,.07);
 // head + hair + eyes
 ctx.fillStyle="#f0c6a2";ctx.beginPath();ctx.arc(0,-.38,.25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#5b3a2a";ctx.beginPath();ctx.arc(-.03,-.47,.23,Math.PI,Math.PI*2);ctx.lineTo(.2,-.4);ctx.lineTo(.08,-.5);ctx.lineTo(-.02,-.39);ctx.lineTo(-.12,-.51);ctx.lineTo(-.24,-.4);ctx.fill();
 ctx.fillStyle="#222";ctx.fillRect(f*.08-.025,-.4,.05,.055);
 // arms
 ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(f*.2,-.08);ctx.lineTo(f*.36,.09);ctx.moveTo(-f*.2,-.08);ctx.lineTo(-f*.32,.1);ctx.stroke();
 // sword arm + sword
 ctx.strokeStyle="#f0c6a2";ctx.lineWidth=.1;ctx.beginPath();ctx.moveTo(f*.2,-.06);ctx.lineTo(f*.39,.05);ctx.stroke();
 ctx.strokeStyle="#edf2ff";ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(f*.38,.03);ctx.lineTo(f*.72,-.2);ctx.stroke();ctx.strokeStyle="#cda64b";ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(f*.31,-.01);ctx.lineTo(f*.44,.1);ctx.stroke();
 if(hero.charge>0){ctx.strokeStyle="#fff";ctx.lineWidth=.045;ctx.beginPath();ctx.arc(0,0,.57,0,Math.PI*2*hero.charge/100);ctx.stroke()}
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.scale(S,S);
 ctx.strokeStyle="#34394f";ctx.lineWidth=.025;for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])slime(x,y,board[y][x]);
 if(pair){slime(pair.x,pair.y,makeSlime(pair.a));slime(pair.x,pair.y+1,makeSlime(pair.b))}
 drawHero();ctx.restore();
}
function loop(t){let dt=Math.min(32,t-last);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",z:"jump",x:"attack",c:"grab",v:"special"};
addEventListener("keydown",e=>{let k=map[e.key];if(!k)return;e.preventDefault();keys[k]=true;if(k==="jump"&&!e.repeat)jump();if(k==="grab"&&!e.repeat)grab();if(k==="special"&&!e.repeat)doSpecial()});
addEventListener("keyup",e=>{let k=map[e.key];if(!k)return;e.preventDefault();if(k==="attack")attack();keys[k]=false});
document.querySelectorAll("button").forEach(b=>{let k=b.dataset.key;const down=e=>{e.preventDefault();keys[k]=true;b.classList.add("pressed");if(k==="jump")jump();if(k==="grab")grab();if(k==="special")doSpecial()};const up=e=>{e.preventDefault();if(k==="attack")attack();keys[k]=false;b.classList.remove("pressed")};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up)});
