(()=>{
const el=document.getElementById("columnsBoard"); if(!el)return;
const C=6,R=13,colors=["#ef5c66","#55b9ff","#ffd85b","#69d783","#b46df0","#ff9b4b"];
let board,piece,score=0,chain=0,running=false,resolving=false,timer=null;
const scoreEl=document.getElementById("columnsScore"),chainEl=document.getElementById("columnsChain");
const cells=[];
el.innerHTML="";
for(let y=0;y<R;y++)for(let x=0;x<C;x++){let d=document.createElement("div");d.className="colCell";el.appendChild(d);cells.push(d)}
function rnd(){return colors[Math.floor(Math.random()*colors.length)]}
function sync(){scoreEl.textContent=score;chainEl.textContent=chain}
function render(){
 for(let y=0;y<R;y++)for(let x=0;x<C;x++){let d=cells[y*C+x],c=board?.[y]?.[x];d.innerHTML=c?'<i class="jewel" style="--jc:'+c+'"></i>':""}
 if(piece)for(let i=0;i<3;i++){let y=piece.y+i;if(y>=0&&y<R){cells[y*C+piece.x].innerHTML='<i class="jewel activeJewel" style="--jc:'+piece.g[i]+'"></i>'}}
}
function spawn(){piece={x:2,y:0,g:[rnd(),rnd(),rnd()]};if(board[0][2]||board[1][2]||board[2][2]){piece=null;gameOver()}render()}
function can(x,y){if(x<0||x>=C||y<0||y+2>=R)return false;for(let i=0;i<3;i++)if(board[y+i][x])return false;return true}
function move(dx){if(running&&!resolving&&piece&&can(piece.x+dx,piece.y)){piece.x+=dx;render()}}
function rotate(){if(!running){reset();return}if(resolving||!piece)return;piece.g.unshift(piece.g.pop());render()}
function hardDrop(){if(!running||resolving||!piece)return;while(can(piece.x,piece.y+1))piece.y++;render();setTimeout(lock,70)}
function step(){if(!running||resolving||!piece)return;if(can(piece.x,piece.y+1)){piece.y++;render()}else lock()}
function lock(){if(!piece)return;for(let i=0;i<3;i++)board[piece.y+i][piece.x]=piece.g[i];piece=null;render();resolve(1)}
function matches(){
 let hit=new Set(),dirs=[[1,0],[0,1],[1,1],[1,-1]];
 for(let y=0;y<R;y++)for(let x=0;x<C;x++){let c=board[y][x];if(!c)continue;
  for(const[dx,dy]of dirs){let a=[[x,y]],xx=x+dx,yy=y+dy;while(xx>=0&&xx<C&&yy>=0&&yy<R&&board[yy][xx]===c){a.push([xx,yy]);xx+=dx;yy+=dy}if(a.length>=3)a.forEach(([px,py])=>hit.add(px+","+py))}
 }return [...hit].map(s=>s.split(",").map(Number))
}
function gravity(){for(let x=0;x<C;x++){let a=[];for(let y=R-1;y>=0;y--)if(board[y][x])a.push(board[y][x]);for(let y=R-1,i=0;y>=0;y--)board[y][x]=i<a.length?a[i++]:null}}
function resolve(n){resolving=true;let m=matches();if(!m.length){chain=n-1;resolving=false;sync();spawn();return}
 chain=n;score+=m.length*10*n;sync();m.forEach(([x,y])=>cells[y*C+x].classList.add("pop"));
 setTimeout(()=>{m.forEach(([x,y])=>{board[y][x]=null;cells[y*C+x].classList.remove("pop")});gravity();render();setTimeout(()=>resolve(n+1),140)},220)
}
function gameOver(){running=false;clearInterval(timer);el.classList.add("gameOver");let o=document.createElement("div");o.className="columnsOver";o.innerHTML="<b>GAME OVER</b><small>↻ 並替で再挑戦</small>";el.appendChild(o)}
function reset(){clearInterval(timer);el.classList.remove("gameOver");el.querySelector(".columnsOver")?.remove();board=Array.from({length:R},()=>Array(C).fill(null));score=chain=0;running=true;resolving=false;sync();spawn();timer=setInterval(step,650)}
window.startColumns=reset;
document.querySelectorAll("[data-col]").forEach(b=>b.addEventListener("pointerdown",e=>{e.preventDefault();let a=b.dataset.col;if(a==="left")move(-1);else if(a==="right")move(1);else if(a==="rotate")rotate();else hardDrop()}));
addEventListener("keydown",e=>{if(document.getElementById("columnsScreen").style.display==="none")return;if(e.key==="ArrowLeft")move(-1);else if(e.key==="ArrowRight")move(1);else if(e.key==="ArrowUp"||e.key==="x")rotate();else if(e.key==="ArrowDown"||e.key===" ")hardDrop()});
})();