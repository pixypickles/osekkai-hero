(()=>{
const cv=document.getElementById("columnsCanvas"); if(!cv)return;
const ctx=cv.getContext("2d"), C=6,R=13,S=45,OX=45,OY=22;
const colors=["#ef5c66","#55b9ff","#ffd85b","#69d783","#b46df0","#ff9b4b"];
let board,piece,score,chain,last=0,acc=0,running=false,resolving=false;
const scoreEl=document.getElementById("columnsScore"),chainEl=document.getElementById("columnsChain");
function rnd(){return colors[Math.floor(Math.random()*colors.length)]}
function reset(){board=Array.from({length:R},()=>Array(C).fill(null));score=chain=0;piece=null;resolving=false;spawn();sync()}
function spawn(){piece={x:2,y:-2,g:[rnd(),rnd(),rnd()]};if(board[0][2])gameOver()}
function sync(){scoreEl.textContent=score;chainEl.textContent=chain}
function can(x,y){for(let i=0;i<3;i++){let yy=Math.floor(y)+i;if(x<0||x>=C||yy>=R)return false;if(yy>=0&&board[yy][x])return false}return true}
function move(dx){if(!running||resolving)return;if(can(piece.x+dx,piece.y))piece.x+=dx}
function rotate(){if(!running||resolving)return;piece.g.unshift(piece.g.pop())}
function drop(){if(!running||resolving)return;while(can(piece.x,piece.y+1))piece.y++;lock()}
function lock(){for(let i=0;i<3;i++){let y=Math.floor(piece.y)+i;if(y<0){gameOver();return}board[y][piece.x]=piece.g[i]}piece=null;resolve(1)}
function matches(){
 let hit=new Set(),dirs=[[1,0],[0,1],[1,1],[1,-1]];
 for(let y=0;y<R;y++)for(let x=0;x<C;x++){let c=board[y][x];if(!c)continue;
  for(const[dX,dY]of dirs){let cells=[[x,y]],xx=x+dX,yy=y+dY;while(xx>=0&&xx<C&&yy>=0&&yy<R&&board[yy][xx]===c){cells.push([xx,yy]);xx+=dX;yy+=dY}if(cells.length>=3)for(const[a,b]of cells)hit.add(a+","+b)}
 }return [...hit].map(s=>s.split(",").map(Number))
}
function gravity(){for(let x=0;x<C;x++){let vals=[];for(let y=R-1;y>=0;y--)if(board[y][x])vals.push(board[y][x]);for(let y=R-1,i=0;y>=0;y--)board[y][x]=i<vals.length?vals[i++]:null}}
function resolve(n){resolving=true;let m=matches();if(!m.length){chain=n-1;sync();resolving=false;spawn();return}
 chain=n;score+=m.length*10*n;sync();setTimeout(()=>{for(const[x,y]of m)board[y][x]=null;gravity();setTimeout(()=>resolve(n+1),170)},180)}
function gameOver(){running=false;setTimeout(()=>{ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 30px sans-serif";ctx.fillText("GAME OVER",180,285);ctx.font="16px sans-serif";ctx.fillText("↻ 並替ボタンで再挑戦",180,320)},20)}
function gem(x,y,c){
 let cx=OX+x*S+S/2,cy=OY+y*S+S/2,r=17;
 ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r*.78,cy-r*.35);ctx.lineTo(cx+r*.88,cy+r*.55);ctx.lineTo(cx,cy+r);ctx.lineTo(cx-r*.88,cy+r*.55);ctx.lineTo(cx-r*.78,cy-r*.35);ctx.closePath();ctx.fill();
 ctx.fillStyle="rgba(255,255,255,.42)";ctx.beginPath();ctx.moveTo(cx-7,cy-10);ctx.lineTo(cx+1,cy-13);ctx.lineTo(cx-2,cy-3);ctx.closePath();ctx.fill()
}
function draw(){
 ctx.clearRect(0,0,360,630);let g=ctx.createLinearGradient(0,0,0,630);g.addColorStop(0,"#152544");g.addColorStop(1,"#0b1222");ctx.fillStyle=g;ctx.fillRect(0,0,360,630);
 ctx.fillStyle="rgba(255,255,255,.035)";for(let y=0;y<R;y++)for(let x=0;x<C;x++)ctx.fillRect(OX+x*S+1,OY+y*S+1,S-2,S-2);
 for(let y=0;y<R;y++)for(let x=0;x<C;x++)if(board[y][x])gem(x,y,board[y][x]);
 if(piece)for(let i=0;i<3;i++)if(piece.y+i>=0)gem(piece.x,piece.y+i,piece.g[i]);
 ctx.strokeStyle="rgba(180,215,255,.35)";ctx.lineWidth=2;ctx.strokeRect(OX,OY,C*S,R*S)
}
function tick(t){if(!last)last=t;let dt=Math.min(40,t-last);last=t;if(running&&!resolving&&piece){acc+=dt;if(acc>520){acc=0;if(can(piece.x,piece.y+1))piece.y++;else lock()}}draw();requestAnimationFrame(tick)}
window.startColumns=()=>{running=true;last=0;acc=0;reset()};
if(document.getElementById("columnsScreen")?.style.display==="flex")window.startColumns();
document.querySelectorAll("[data-col]").forEach(b=>{let a=b.dataset.col;let fn=()=>{if(!running&&a==="rotate"){running=true;reset();return}if(a==="left")move(-1);if(a==="right")move(1);if(a==="rotate")rotate();if(a==="down")drop()};b.addEventListener("pointerdown",e=>{e.preventDefault();fn()})});
addEventListener("keydown",e=>{if(document.getElementById("columnsScreen").style.display==="none")return;if(e.key==="ArrowLeft")move(-1);if(e.key==="ArrowRight")move(1);if(e.key==="ArrowUp"||e.key==="x")rotate();if(e.key==="ArrowDown"||e.key===" ")drop()});
requestAnimationFrame(tick);
})();