const cv=document.querySelector("#game"),ctx=cv.getContext("2d");
const W=8,H=14,S=45,COLORS=["#5cdb75","#ff6577","#55aaff","#ffd65a"];
let board=Array.from({length:H},()=>Array(W).fill(null)), score=0, special=0, chain=0, gameOver=false;
const hero={x:3.5,y:H-1.55,vx:0,vy:0,w:.55,h:.8,onGround:false,grab:null,stun:0,charge:0,face:1};
let pair=null, dropTimer=0, dropInterval=1250, keys={}, last=performance.now();

function cell(x,y,type=0){return {color:COLORS[type],hp:Math.random()<.10?4:2,hard:false}}
function spawnPair(){
  let a=Math.floor(Math.random()*4), b=Math.floor(Math.random()*4);
  // "絶妙に下手": 同色接続を軽く評価するが、25%で雑な列を選ぶ
  let scores=Array(W).fill(0).map((_,x)=>{
    let h=columnTop(x), s=Math.random()*1.5;
    if(h<H && h+1<H && board[h+1]?.[x]?.color===COLORS[a])s+=3;
    if(x>0 && h<H && board[h]?.[x-1]?.color===COLORS[a])s+=2;
    if(x<W-1 && h<H && board[h]?.[x+1]?.color===COLORS[a])s+=2;
    s-=Math.max(0,(H-h-5))*.15; return s;
  });
  let x=Math.random()<.25?Math.floor(Math.random()*W):scores.indexOf(Math.max(...scores));
  pair={x,y:-2,a,b};
}
function columnTop(x){for(let y=0;y<H;y++)if(board[y][x])return y-1;return H-1}
function settlePair(){
  const x=pair.x, y1=columnTop(x);
  if(y1<1){gameOver=true;msg("GAME OVER");return}
  board[y1][x]=cell(x,y1,pair.a);
  board[y1-1][x]=cell(x,y1-1,pair.b);
  // hard slime starts appearing later
  if(score>800 && Math.random()<Math.min(.28,score/7000)){board[y1][x].hp=4;board[y1][x].hard=true}
  pair=null; resolve();
}
function resolve(){
  let groups=[],vis=Array.from({length:H},()=>Array(W).fill(false));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]&&!vis[y][x]){
    let q=[[x,y]],g=[],col=board[y][x].color;vis[y][x]=true;
    while(q.length){let [cx,cy]=q.pop();g.push([cx,cy]);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=cx+dx,ny=cy+dy;if(nx>=0&&nx<W&&ny>=0&&ny<H&&!vis[ny][nx]&&board[ny][nx]?.color===col){vis[ny][nx]=true;q.push([nx,ny])}}}
    if(g.length>=4)groups.push(g);
  }
  if(!groups.length){chain=0;return}
  chain++; document.querySelector("#chain").textContent=chain;
  for(const g of groups)for(const [x,y] of g){board[y][x]=null;score+=10*chain;special=Math.min(100,special+3*chain)}
  setTimeout(()=>{gravity();resolve()},180);
}
function gravity(){for(let x=0;x<W;x++){let vals=[];for(let y=H-1;y>=0;y--)if(board[y][x])vals.push(board[y][x]);for(let y=H-1,i=0;y>=0;y--)board[y][x]=i<vals.length?vals[i++]:null}}
function solidAt(x,y){let ix=Math.floor(x),iy=Math.floor(y);return ix<0||ix>=W||iy>=H||(iy>=0&&board[iy][ix])}
function update(dt){
 if(gameOver)return;
 dropTimer+=dt;if(!pair)spawnPair();if(dropTimer>dropInterval){dropTimer=0;settlePair();dropInterval=Math.max(520,1250-score*.08)}
 if(hero.stun>0){hero.stun-=dt;return}
 hero.vx=0;if(keys.left){hero.vx=-.005*dt;hero.face=-1}if(keys.right){hero.vx=.005*dt;hero.face=1}
 hero.x=Math.max(.3,Math.min(W-.3,hero.x+hero.vx));
 hero.vy+=.000028*dt;let ny=hero.y+hero.vy*dt;
 hero.onGround=false;
 if(hero.vy>=0 && solidAt(hero.x,ny+hero.h/2)){hero.vy=0;hero.y=Math.floor(ny+hero.h/2)-hero.h/2;hero.onGround=true}else hero.y=ny;
 if(hero.y>H){hero.y=H-1.5;hero.vy=0}
 if(keys.attack)hero.charge=Math.min(100,hero.charge+dt*.09);
 document.querySelector("#score").textContent=score;document.querySelector("#specialText").textContent=Math.floor(special)+"%";document.querySelector("#specialBar").style.width=special+"%";
}
function jump(){if(hero.onGround||hero.grab){hero.vy=-.012;hero.grab=null}}
function attack(){
 let power=hero.charge>=75?4:1;hero.charge=0;let dx=hero.face,dy=0;if(keys.up){dx=0;dy=-1}if(keys.down){dx=0;dy=1}
 let tx=Math.floor(hero.x+dx*.8),ty=Math.floor(hero.y+dy*.9);if(tx>=0&&tx<W&&ty>=0&&ty<H&&board[ty][tx]){board[ty][tx].hp-=power;if(board[ty][tx].hp<=0){board[ty][tx]=null;score+=5;gravity();resolve()}}
}
function grab(){
 if(hero.grab){hero.grab=null;return}
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let x=Math.floor(hero.x)+dx,y=Math.floor(hero.y)+dy;if(x>=0&&x<W&&y>=0&&y<H&&board[y][x]){hero.grab={x,y};hero.vy=0;return}}
}
function doSpecial(){
 if(special<100)return;special=0;let cx=Math.floor(hero.x),cy=Math.floor(hero.y);
 let cells=[];for(let d=-2;d<=2;d++){cells.push([cx+d,cy],[cx,cy+d])}for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])cells.push([cx+dx,cy+dy]);
 for(const [x,y] of cells)if(x>=0&&x<W&&y>=0&&y<H)board[y][x]=null;gravity();resolve();msg("おせっかい十字斬り！");
}
function msg(t){let m=document.querySelector("#message");m.textContent=t;if(!gameOver)setTimeout(()=>m.textContent="",900)}
function draw(){
 ctx.clearRect(0,0,cv.width,cv.height);ctx.save();ctx.scale(S,S);
 ctx.strokeStyle="#34394f";ctx.lineWidth=.025;for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])drawSlime(x,y,board[y][x]);
 if(pair){drawSlime(pair.x,pair.y,cell(0,0,pair.a));drawSlime(pair.x,pair.y+1,cell(0,0,pair.b))}
 ctx.fillStyle=hero.stun>0?"#aaa":"#eee";ctx.fillRect(hero.x-hero.w/2,hero.y-hero.h/2,hero.w,hero.h);ctx.fillStyle="#333";ctx.fillRect(hero.x+hero.face*.18-.06,hero.y-.12,.12,.12);
 if(hero.charge>0){ctx.strokeStyle="#fff";ctx.lineWidth=.05;ctx.beginPath();ctx.arc(hero.x,hero.y,.45,0,Math.PI*2*hero.charge/100);ctx.stroke()}
 ctx.restore();
}
function drawSlime(x,y,s){if(y<0)return;ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(x+.05,y+.08,.9,.84,.25);ctx.fill();ctx.fillStyle="#202438";ctx.fillRect(x+.27,y+.38,.1,.1);ctx.fillRect(x+.63,y+.38,.1,.1);if(s.hard){ctx.strokeStyle="#ddd";ctx.lineWidth=.08;ctx.strokeRect(x+.12,y+.15,.76,.55)}}
function loop(t){let dt=Math.min(32,t-last);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);

const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",z:"jump",x:"attack",c:"grab",v:"special"};
addEventListener("keydown",e=>{let k=map[e.key];if(!k)return;keys[k]=true;if(k==="jump"&&!e.repeat)jump();if(k==="grab"&&!e.repeat)grab();if(k==="special"&&!e.repeat)doSpecial()});
addEventListener("keyup",e=>{let k=map[e.key];if(!k)return;if(k==="attack")attack();keys[k]=false});
document.querySelectorAll("button").forEach(b=>{let k=b.dataset.key;const down=e=>{e.preventDefault();keys[k]=true;b.classList.add("pressed");if(k==="jump")jump();if(k==="grab")grab();if(k==="special")doSpecial()};const up=e=>{e.preventDefault();if(k==="attack")attack();keys[k]=false;b.classList.remove("pressed")};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up)});
