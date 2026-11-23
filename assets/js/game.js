(() => {
  const ROUTE_COLORS=['#B94A3E','#28796F','#8863A8','#BD7D25','#4775A6','#B14E79','#4A8192','#8B6539','#6575A8','#6F8740','#A05E42','#59636D'];
  const ROUTES='ABCDEFGHIJKL'.split('');
  const dirs=[{x:1,y:0,icon:'➤',name:'direita'},{x:0,y:1,icon:'▼',name:'baixo'},{x:-1,y:0,icon:'◀',name:'esquerda'},{x:0,y:-1,icon:'▲',name:'cima'}];
  const mazeEl=document.querySelector('#maze');
  const mainEl=document.querySelector('main');
  const pondCanvas=document.querySelector('#bg');
  const programEl=document.querySelector('#program');
  const statusEl=document.querySelector('#status');
  const countEl=document.querySelector('#block-count');
  const teamTitle=document.querySelector('#team-title');
  const teamSelectors=document.querySelector('#team-selectors');
  const teamPickerToggle=document.querySelector('#team-picker-toggle');
  const teamPickerLabel=document.querySelector('#team-picker-label');
  const teamPickerDot=document.querySelector('#team-picker-dot');
  const setupSize=document.querySelector('#setup-size');
  const setupTeams=document.querySelector('#setup-teams');
  const setupSeed=document.querySelector('#setup-seed');
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const commandNames={forward:'Avançar',left:'Virar à esquerda',right:'Virar à direita'};
  const teamPrograms=Array.from({length:12},()=>[]);
  let size=33;
  let center=(size-1)/2;
  let teamCount=5;
  let mazeGrid=[];
  let mazeCells=[];
  let mazeSeed=0;
  let seedCode='';
  let routeData=[];
  let goal={x:center,y:center};
  let activeTeam=0;
  let blocks=teamPrograms[0];
  let player={x:0,y:0,dir:0};
  let displayedPlayer=null;
  let busy=false;
  let toastId=0;
  let activeToast=null;
  let toastGroupTimer=null;
  let rowNodes=new Map();
  let failedPath=null;
  let solutionCache=[];
  let simulatingAll=false;
  let stopAllRequested=false;
  const demoSpeeds=[0.5,1,2,5];
  let demoSpeedIndex=1;
  let roomCode='';
  let roomRole='';
  let roomReady=false;
  let roomMembers=0;
  let applyingRoomState=false;
  let lastRoomState='';
  let pendingRun=false;
  let joinTimeout=null;
  let roomStateReceived=false;
  let roomOwnerId='';
  let assignedTeamIndex=-1;
  let roomSpectating=false;
  let roomAssignments=new Map();
  let roomPresence=[];
  let remotePlayers=new Map();
  let remotePlayerTokens=new Map();
  let runActorId='';
  let lastPositionBroadcast=0;
  let positionBroadcastTimer=null;
  let pendingPosition=null;
  const fitPond=()=>{pondCanvas.style.height=`${mainEl.scrollHeight}px`;};
  fitPond();
  new ResizeObserver(fitPond).observe(mainEl);

  function mulberry32(seed){let value=seed>>>0;return()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function keyOf(x,y){return`${x},${y}`;}
  function pointOf(key){return key.split(',').map(Number);}
  function buildGraph(){
    const nodes=[];const nodeSet=new Set();
    for(let y=1;y<size-1;y+=2)for(let x=1;x<size-1;x+=2){const key=keyOf(x,y);nodes.push(key);nodeSet.add(key);}
    const adjacency=new Map(nodes.map(key=>[key,[]]));
    for(const key of nodes){const [x,y]=pointOf(key);for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){const next=keyOf(x+dx,y+dy);if(nodeSet.has(next))adjacency.get(key).push(next);}}
    return{nodes,nodeSet,adjacency};
  }
  function perimeterNodes(graph){
    const edge=size-2;const points=[];
    for(let x=1;x<=edge;x+=2)points.push(keyOf(x,1));
    for(let y=3;y<=edge;y+=2)points.push(keyOf(edge,y));
    for(let x=edge-2;x>=1;x-=2)points.push(keyOf(x,edge));
    for(let y=edge-2;y>1;y-=2)points.push(keyOf(1,y));
    return points.filter(key=>graph.nodeSet.has(key));
  }
  function generateMaze(seed){
    const graph=buildGraph();const random=mulberry32(seed);const root=keyOf(center%2===1?center:center-1,center%2===1?center:center-1);const edgeNodes=perimeterNodes(graph);const goalPoint=pointOf(root);let best=null;
    function pathFrom(start,grid){
      const origin=keyOf(start.x,start.y),target=keyOf(goalPoint[0],goalPoint[1]);const previous=new Map([[origin,null]]);const queue=[origin];
      for(let cursor=0;cursor<queue.length&&!previous.has(target);cursor++){const current=queue[cursor];const [x,y]=pointOf(current);for(const direction of dirs){const nx=x+direction.x,ny=y+direction.y,next=keyOf(nx,ny);if(previous.has(next)||!grid[ny]||grid[ny][nx]==='#')continue;previous.set(next,current);queue.push(next);}}
      if(!previous.has(target))return[];const path=[];for(let current=target;current!==null;current=previous.get(current))path.push(pointOf(current));return path.reverse();
    }
    for(let attempt=0;attempt<10;attempt++){
      const parent=new Map([[root,null]]);const stack=[root];
      while(stack.length){const current=stack[stack.length-1];const choices=graph.adjacency.get(current).filter(next=>!parent.has(next));if(!choices.length){stack.pop();continue;}const next=choices[Math.floor(random()*choices.length)];parent.set(next,current);stack.push(next);}
      const grid=Array.from({length:size},()=>Array(size).fill('#'));
      for(const key of parent.keys()){const [x,y]=pointOf(key);grid[y][x]='.';}
      for(const [key,previous] of parent){if(!previous)continue;const [x,y]=pointOf(key),[px,py]=pointOf(previous);grid[(y+py)/2][(x+px)/2]='.';}
      const braidRadius=Math.max(4,Math.floor(size*.22));
      for(const key of graph.nodes){const [x,y]=pointOf(key);for(const [dx,dy] of [[2,0],[0,2]]){const next=keyOf(x+dx,y+dy);if(!graph.nodeSet.has(next)||parent.get(key)===next||parent.get(next)===key)continue;const distanceFromCenter=Math.abs(x-goalPoint[0])+Math.abs(y-goalPoint[1]);const centrality=Math.max(0,1-distanceFromCenter/(braidRadius*2));if(random()<.025+.48*centrality)grid[y+dy/2][x+dx/2]='.';}}
      const starts=[];for(let index=0;index<teamCount;index++){const [x,y]=pointOf(edgeNodes[Math.floor(index*edgeNodes.length/teamCount)]);starts.push({id:ROUTES[index],x,y,dir:0,color:ROUTE_COLORS[index]});}
      const paths=starts.map(route=>pathFrom(route,grid));if(paths.some(path=>!path.length))continue;
      const lengths=paths.map(path=>path.length-1);const minLength=Math.min(...lengths),maxLength=Math.max(...lengths);let shared=0,pairs=0;
      for(let a=0;a<paths.length;a++)for(let b=a+1;b<paths.length;b++){const cells=new Set(paths[a].slice(1,-1).map(([x,y])=>keyOf(x,y)));const overlap=paths[b].slice(1,-1).filter(([x,y])=>cells.has(keyOf(x,y))).length;shared+=overlap/Math.max(1,Math.min(lengths[a],lengths[b]));pairs++;}
      const score=(pairs?shared/pairs:0)+Math.max(0,maxLength/Math.max(1,minLength)-1)*.55;
      if(!best||score<best.score){for(let index=0;index<starts.length;index++){const [sx,sy]=paths[index][0],[nx,ny]=paths[index][1]||paths[index][0];starts[index].dir=dirs.findIndex(direction=>direction.x===nx-sx&&direction.y===ny-sy);}
        grid[goalPoint[1]][goalPoint[0]]='*';for(const route of starts)grid[route.y][route.x]=route.id;best={grid,starts,goal:{x:goalPoint[0],y:goalPoint[1]},score};}
    }
    return best;
  }
  function activeRoute(){return routeData[activeTeam];}
  function restoreCell(x,y){const cell=mazeCells[y]?.[x];if(!cell)return;cell.classList.remove('player');const value=mazeGrid[y][x];cell.textContent=value==='.'?'':value==='*'?'✦':value;const route=routeData.find(item=>item.id===value);if(route)cell.style.setProperty('--team-color',route.color);else cell.style.removeProperty('--team-color');}
  function updateExplorer(){
    if(displayedPlayer)restoreCell(displayedPlayer.x,displayedPlayer.y);
    if(roomReady&&assignedTeamIndex<0){displayedPlayer=null;return;}
    const cell=mazeCells[player.y]?.[player.x];
    if(cell){cell.classList.add('player');cell.textContent=dirs[player.dir].icon;cell.style.setProperty('--team-color',activeRoute().color);}
    displayedPlayer={x:player.x,y:player.y};
    mazeEl.setAttribute('aria-label',`Labirinto quadrado de ${size} por ${size}. Equipe ${activeTeam+1}, saída ${activeRoute().id}. Explorador na linha ${player.y+1}, coluna ${player.x+1}, voltado para ${dirs[player.dir].name}. Objetivo no centro.`);
    if(roomReady&&assignedTeamIndex>=0&&!applyingRoomState&&(!runActorId||runActorId===window.LabicompRoom.clientId))queuePositionBroadcast({clientId:window.LabicompRoom.clientId,team:activeTeam,x:player.x,y:player.y,dir:player.dir});
  }
  function drawMaze(){mazeEl.replaceChildren();mazeEl.style.setProperty('--maze-size',size);mazeCells=Array.from({length:size},()=>[]);displayedPlayer=null;mazeGrid.forEach((row,y)=>row.forEach((value,x)=>{const cell=document.createElement('div');cell.className='cell';if(value==='#')cell.classList.add('wall');else if(value==='*'){cell.classList.add('goal');cell.textContent='✦';}else if(ROUTES.includes(value)){const route=routeData.find(item=>item.id===value);cell.classList.add('start');cell.textContent=value;cell.style.setProperty('--team-color',route.color);cell.setAttribute('aria-label',`Saída ${value}`);}mazeCells[y][x]=cell;mazeEl.append(cell);}));updateExplorer();}
  function drawRouteLegend(){const legend=document.querySelector('#route-legend');legend.replaceChildren();routeData.forEach((route,index)=>{const item=document.createElement('span');item.style.setProperty('--team-color',route.color);const swatch=document.createElement('i');swatch.className='route-swatch';swatch.textContent=route.id;item.append(swatch,document.createTextNode(` Equipe ${index+1}`));legend.append(item);});}
  function resetTeamPlayer(){if(roomReady&&assignedTeamIndex<0){if(displayedPlayer)restoreCell(displayedPlayer.x,displayedPlayer.y);displayedPlayer=null;updateActionAvailability();return;}const route=activeRoute();player={x:route.x,y:route.y,dir:route.dir};updateExplorer();}
  const CONFIG_RADIX=154n;
  function encodeSeedCode(randomSeed,mazeSize,teams){const sizeIndex=(mazeSize-15)/2;const config=sizeIndex*11+(teams-2);return(BigInt(randomSeed)*CONFIG_RADIX+BigInt(config)).toString(36).padStart(8,'0');}
  function decodeSeedCode(value){
    const code=String(value).trim().toLowerCase();if(!/^[0-9a-z]{1,8}$/.test(code))return null;
    let packed=0n;for(const character of code)packed=packed*36n+BigInt(parseInt(character,36));
    const config=Number(packed%CONFIG_RADIX),randomSeed=Number(packed/CONFIG_RADIX),sizeIndex=Math.floor(config/11),teams=config%11+2;
    if(randomSeed<1||randomSeed>4294967295||sizeIndex>13)return null;
    return{code:code.padStart(8,'0'),seed:randomSeed,size:15+sizeIndex*2,teams};
  }
  function randomSeed(){const values=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(values);return values[0]||Math.floor(Math.random()*4294967295)+1;}
  function activateMaze(code){
    const config=decodeSeedCode(code);if(!config)return false;
    size=config.size;center=(size-1)/2;teamCount=config.teams;seedCode=config.code;
    setNewMaze(config.seed,true);document.querySelector('#welcome').hidden=true;mainEl.classList.add('game-ready');mainEl.classList.remove('guest-view');
    if(roomPresence.length)applyRoomPresence(roomPresence);
    return true;
  }
  function setNewMaze(seed,clearPrograms=false){
    clearHighlights();mazeSeed=(Math.abs(Math.trunc(Number(seed)))||Math.floor(Math.random()*2147483646)+1)>>>0;
    solutionCache=[];
    const generated=generateMaze(mazeSeed);mazeGrid=generated.grid;routeData=generated.starts;goal=generated.goal;
    if(clearPrograms){teamPrograms.forEach((_,index)=>teamPrograms[index]=[]);activeTeam=0;}
    activeTeam=Math.min(activeTeam,teamCount-1);blocks=teamPrograms[activeTeam];document.querySelector('#maze-dimensions-copy').textContent=`${size} × ${size}`;document.querySelector('#team-total').textContent=String(teamCount);document.querySelector('#team-total').setAttribute('aria-label',`${teamCount} equipes`);
    teamTitle.textContent=`Equipe ${activeTeam+1} · Saída ${activeRoute().id}`;
    drawRouteLegend();renderTeamSelectors();resetTeamPlayer();drawMaze();drawProgram();setStatus(`Labirinto ${size} × ${size} gerado com ${teamCount} equipes igualmente distribuídas.`);
  }
  function renderTeamSelectors(){
    teamSelectors.replaceChildren();const activeRouteData=routeData[activeTeam];if(!activeRouteData)return;
    const unassigned=roomReady&&assignedTeamIndex<0;teamPickerLabel.textContent=unassigned?'?':activeRouteData.id;teamPickerDot.style.setProperty('--team-color',unassigned?'var(--ac)':activeRouteData.color);teamPickerToggle.style.setProperty('--team-color',unassigned?'var(--ac)':activeRouteData.color);teamPickerToggle.setAttribute('aria-label',unassigned?(roomSpectating?'Modo espectador. Escolher equipe':'Escolha uma equipe para começar'):`Equipe ${activeTeam+1}, saída ${activeRouteData.id}. Escolher equipe`);
    if(roomReady&&roomRole==='host'&&!roomSpectating){const spectator=document.createElement('button');spectator.type='button';spectator.className='team-selector spectator-selector';spectator.dataset.spectator='true';spectator.textContent=roomSpectating?'Continuar como espectador':'Assistir como espectador';spectator.disabled=busy;spectator.setAttribute('aria-pressed',String(roomSpectating));teamSelectors.append(spectator);}
    for(let index=0;index<teamCount;index++){const route=routeData[index];const owner=roomAssignments.get(index);const occupiedByOther=roomReady&&owner&&owner!==window.LabicompRoom.clientId;const button=document.createElement('button');button.type='button';button.className='team-selector';button.dataset.team=String(index);button.style.setProperty('--team-color',route.color);button.disabled=busy||Boolean(occupiedByOther);button.setAttribute('aria-pressed',String(index===activeTeam&&(!roomReady||assignedTeamIndex>=0)));button.setAttribute('aria-label',`Selecionar equipe ${index+1}, saída ${route.id}${occupiedByOther?', já escolhida':''}`);const dot=document.createElement('i');dot.className='team-dot';dot.setAttribute('aria-hidden','true');const label=document.createElement('b');label.className='team-route-label';label.textContent=route.id;button.append(dot,label);if(occupiedByOther){const occupied=document.createElement('small');occupied.textContent='Em uso';button.append(occupied);}teamSelectors.append(button);}
  }
  function closeTeamPicker(returnFocus=false){teamSelectors.hidden=true;teamPickerToggle.setAttribute('aria-expanded','false');if(returnFocus)teamPickerToggle.focus();}
  teamPickerToggle.addEventListener('click',()=>{const open=teamPickerToggle.getAttribute('aria-expanded')==='true';teamSelectors.hidden=open;teamPickerToggle.setAttribute('aria-expanded',String(!open));if(!open)teamSelectors.querySelector('[data-team][aria-pressed="true"]')?.focus();});
  document.addEventListener('click',event=>{if(!event.target.closest('.team-picker'))closeTeamPicker();});
  teamPickerToggle.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();teamSelectors.hidden=false;teamPickerToggle.setAttribute('aria-expanded','true');teamSelectors.querySelector('[data-team][aria-pressed="true"]')?.focus();}});
  teamSelectors.addEventListener('keydown',event=>{const options=[...teamSelectors.querySelectorAll('[data-team]')];const index=options.indexOf(event.target.closest('[data-team]'));if(event.key==='Escape'){event.preventDefault();closeTeamPicker(true);}else if(event.key==='ArrowDown'||event.key==='ArrowRight'){event.preventDefault();options[(index+1)%options.length]?.focus();}else if(event.key==='ArrowUp'||event.key==='ArrowLeft'){event.preventDefault();options[(index-1+options.length)%options.length]?.focus();}else if(event.key==='Home'){event.preventDefault();options[0]?.focus();}else if(event.key==='End'){event.preventDefault();options.at(-1)?.focus();}});
  teamSelectors.addEventListener('click',event=>{const button=event.target.closest('[data-spectator]');if(button&&!busy&&roomRole==='host'){if(!roomSpectating){if(assignedTeamIndex>=0)sendRoom('room-player',{clientId:window.LabicompRoom.clientId,remove:true});roomSpectating=true;assignedTeamIndex=-1;activeTeam=0;blocks=teamPrograms[0];window.LabicompRoom.updatePresence({teamIndex:null,spectating:true});clearHighlights();teamTitle.textContent='Modo espectador';renderTeamSelectors();closeTeamPicker(true);resetTeamPlayer();drawProgram();setStatus('Você está assistindo como espectador.');}return;}const teamButton=event.target.closest('[data-team]');if(!teamButton||busy||teamButton.disabled)return;activeTeam=Number(teamButton.dataset.team);assignedTeamIndex=activeTeam;roomSpectating=false;blocks=teamPrograms[activeTeam];if(roomReady)window.LabicompRoom.updatePresence({teamIndex:activeTeam,spectating:false});clearHighlights();teamTitle.textContent=`Equipe ${activeTeam+1} · Saída ${activeRoute().id}`;renderTeamSelectors();closeTeamPicker(true);resetTeamPlayer();drawProgram();setStatus(`Equipe ${activeTeam+1} selecionada.`);});
  function updateRoomControls(){
    const isHost=roomReady&&roomRole==='host';
    document.querySelector('#show-qr').hidden=!isHost;
    document.querySelector('#new-maze').hidden=!isHost;
    const codeButton=document.querySelector('#room-code-button');codeButton.hidden=!roomReady;
    codeButton.textContent=roomReady?roomCode:'';
    if(roomReady)codeButton.setAttribute('aria-label',`Copiar código da sala ${roomCode}`);
  }
  document.querySelector('#new-maze').addEventListener('click',()=>{if(busy||roomRole!=='host')return;remotePlayers.clear();remotePlayerTokens.clear();document.querySelector('#solver-overlays').replaceChildren();activateMaze(encodeSeedCode(randomSeed(),size,teamCount));broadcastRoomState(true);sendRoom('room-request-players',{});});
  setupSize.addEventListener('input',()=>{document.querySelector('#setup-size-value').textContent=`${setupSize.value} × ${setupSize.value}`;});
  setupTeams.addEventListener('input',()=>{document.querySelector('#setup-teams-value').textContent=setupTeams.value;});
  function randomRoomCode(){const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';const values=new Uint8Array(6);crypto.getRandomValues(values);return Array.from(values,value=>alphabet[value%alphabet.length]).join('');}
  async function createRoom(){
    const error=document.querySelector('#room-create-error');error.textContent='';
    if(!window.LabicompRoom?.configured()){error.textContent='Configure o Supabase em assets/js/supabase-config.js antes de criar uma sala.';return;}
    const rawSeed=setupSeed.value.trim();const chosenSeed=rawSeed?Number(rawSeed):randomSeed();if(rawSeed&&(!/^\d+$/.test(rawSeed)||!Number.isSafeInteger(chosenSeed)||chosenSeed<1||chosenSeed>4294967295)){error.textContent='Informe uma semente inteira entre 1 e 4294967295, ou deixe em branco para gerar uma.';return;}
    const code=randomRoomCode();const mazeCode=encodeSeedCode(chosenSeed,Number(setupSize.value),Number(setupTeams.value));
    try{await connectToRoom(code,'host');roomOwnerId=window.LabicompRoom.clientId;activateMaze(mazeCode);broadcastRoomState(true);setStatus(`Sala ${code} criada.`);}
    catch(reason){await leaveRoom();error.textContent=reason.message||'Não foi possível criar a sala.';}
  }
  async function joinRoom(inviteCode=''){
    const input=document.querySelector('#room-code-input');const error=document.querySelector('#room-join-error');const code=String(inviteCode||input.value).toUpperCase().replace(/[^A-Z0-9]/g,'');if(inviteCode)input.value=code;error.textContent='';
    if(code.length!==6){error.textContent='Digite os seis caracteres do código da sala.';return;}
    if(!window.LabicompRoom?.configured()){error.textContent='O Supabase ainda não está configurado.';return;}
    try{await connectToRoom(code,'student');error.textContent='';await sendRoom('room-request-state',{});await sendRoom('room-request-players',{});clearTimeout(joinTimeout);joinTimeout=setTimeout(async()=>{if(roomRole!=='student'||roomStateReceived)return;await leaveRoom();error.textContent='Sala não encontrada. Confira o código e se o anfitrião está conectado.';},7000);}
    catch(reason){await leaveRoom();error.textContent=reason.message||'Não foi possível entrar na sala.';}
  }
  async function connectToRoom(code,role){
    await leaveRoom();assignedTeamIndex=-1;await window.LabicompRoom.connect(code,role);roomCode=code;roomRole=role;roomReady=true;roomStateReceived=false;lastRoomState='';remotePlayers.clear();remotePlayerTokens.clear();updateRoomControls();updateRoomStatus();
  }
  async function leaveRoom(){clearTimeout(joinTimeout);clearTimeout(positionBroadcastTimer);positionBroadcastTimer=null;pendingPosition=null;roomReady=false;roomStateReceived=false;roomCode='';roomRole='';roomOwnerId='';roomMembers=0;lastRoomState='';roomAssignments.clear();roomPresence=[];roomSpectating=false;assignedTeamIndex=-1;remotePlayers.clear();remotePlayerTokens.clear();runActorId='';document.querySelector('#solver-overlays').replaceChildren();updateRoomControls();const status=document.querySelector('#room-status');if(status)status.textContent='';if(window.LabicompRoom)await window.LabicompRoom.disconnect();}
  function updateRoomStatus(){document.querySelector('#room-status').textContent=roomReady?`${roomMembers||1} online`:'';}
  async function sendRoom(event,payload){if(!roomReady)return;try{await window.LabicompRoom.send(event,payload);}catch(reason){setStatus(reason.message||'Falha ao sincronizar a sala.','error');}}
  function roomSnapshot(){return{seed:seedCode,programs:teamPrograms.slice(0,teamCount),ownerId:roomOwnerId};}
  function broadcastRoomState(force=false){if(!roomReady||applyingRoomState)return;const state=roomSnapshot();const signature=JSON.stringify(state);if(!force&&signature===lastRoomState)return;lastRoomState=signature;sendRoom('room-state',state);}
  function sanitizeProgram(value,depth=0){
    if(!Array.isArray(value)||value.length>300||depth>8)return null;
    const result=[];
    for(const block of value){
      if(!block||!['forward','left','right','loop'].includes(block.type))return null;
      if(block.type==='loop'){const children=sanitizeProgram(block.children,depth+1);if(!children)return null;result.push({type:'loop',times:Math.max(2,Math.min(20,Number(block.times)||2)),children});}
      else result.push({type:block.type});
    }
    return result;
  }
  function applyRoomState(state){
    if(!state||!decodeSeedCode(state.seed)||!Array.isArray(state.programs)||(state.ownerId&&state.sender&&state.sender!==state.ownerId&&(!roomOwnerId||state.seed!==seedCode)))return;
    const config=decodeSeedCode(state.seed);const programs=Array.from({length:config.teams},(_,index)=>sanitizeProgram(state.programs[index]||[]));if(programs.some(program=>program===null))return;
    const mazeChanged=seedCode!==config.code;const firstState=!roomStateReceived;
    applyingRoomState=true;try{if(mazeChanged){remotePlayers.clear();remotePlayerTokens.clear();document.querySelector('#solver-overlays').replaceChildren();activateMaze(config.code);}programs.forEach((program,index)=>teamPrograms[index]=program);roomOwnerId=state.ownerId||roomOwnerId;applyRoomPresence(roomPresence);if(assignedTeamIndex>=0)activeTeam=assignedTeamIndex;blocks=teamPrograms[activeTeam];teamTitle.textContent=assignedTeamIndex<0?(roomSpectating?'Modo espectador':'Escolha sua equipe'):`Equipe ${activeTeam+1} · Saída ${activeRoute().id}`;renderTeamSelectors();if(mazeChanged||firstState)resetTeamPlayer();drawProgram();lastRoomState=JSON.stringify(roomSnapshot());}finally{applyingRoomState=false;}
    roomStateReceived=true;clearTimeout(joinTimeout);document.querySelector('#room-join-error').textContent='';document.querySelector('#welcome').hidden=true;mainEl.classList.add('game-ready');setStatus(`Sala ${roomCode} sincronizada.`);if(mazeChanged||firstState)sendRoom('room-request-players',{});
  }
  function applyRoomPresence(state){
    roomPresence=state||[];const members=roomPresence.flatMap(([key,metas])=>metas.map(meta=>({...meta,presenceKey:key}))).sort((a,b)=>Number(a.joinedAt||0)-Number(b.joinedAt||0)||String(a.clientId||a.presenceKey).localeCompare(String(b.clientId||b.presenceKey)));
    roomMembers=members.length;const assignments=new Map();const occupied=new Set();const host=members.find(member=>member.role==='host'||member.clientId===roomOwnerId);
    if(host&&!host.spectating){const preferred=Number(host.teamIndex);if(Number.isInteger(preferred)&&preferred>=0&&preferred<teamCount){const id=host.clientId||host.presenceKey;assignments.set(preferred,id);occupied.add(preferred);}}
    for(const member of members){if(member===host||member.role==='host'||member.clientId===roomOwnerId)continue;const preferred=Number(member.teamIndex);if(Number.isInteger(preferred)&&preferred>=0&&preferred<teamCount&&!occupied.has(preferred)){assignments.set(preferred,member.clientId||member.presenceKey);occupied.add(preferred);}}
    roomAssignments=assignments;const myId=window.LabicompRoom?.clientId;let myTeam=-1;for(const [team,id] of assignments)if(id===myId){myTeam=team;break;}
    const localMeta=members.find(member=>member.clientId===myId);roomSpectating=Boolean(localMeta?.role==='host'&&localMeta.spectating);if(localMeta&&myTeam>=0&&(Number(localMeta.teamIndex)!==myTeam||localMeta.spectating))window.LabicompRoom.updatePresence({teamIndex:myTeam,spectating:false});else if(localMeta&&myTeam<0&&localMeta.teamIndex!=null)window.LabicompRoom.updatePresence({teamIndex:null});
    const previousTeam=assignedTeamIndex;assignedTeamIndex=myTeam;if(roomReady&&previousTeam>=0&&previousTeam!==myTeam)sendRoom('room-player',{clientId:myId,remove:true});if(roomReady&&routeData.length){if(myTeam>=0){activeTeam=myTeam;blocks=teamPrograms[activeTeam];teamTitle.textContent=`Equipe ${activeTeam+1} · Saída ${activeRoute().id}`;closeTeamPicker();if(previousTeam!==myTeam)resetTeamPlayer();}else{activeTeam=0;blocks=teamPrograms[0];teamTitle.textContent=roomSpectating?'Modo espectador':'Escolha sua equipe';teamSelectors.hidden=false;teamPickerToggle.setAttribute('aria-expanded','true');resetTeamPlayer();}renderTeamSelectors();drawProgram();}
    const activeIds=new Set(members.map(member=>member.clientId||member.presenceKey));for(const id of remotePlayers.keys())if(!activeIds.has(id)){remotePlayers.delete(id);remotePlayerTokens.get(id)?.remove();remotePlayerTokens.delete(id);}renderRemotePlayers();updateRoomStatus();
  }
  function receiveRoomPlayer(position){
    if(!roomReady||!position||position.clientId===window.LabicompRoom.clientId)return;
    if(position.remove){remotePlayers.delete(position.clientId);remotePlayerTokens.get(position.clientId)?.remove();remotePlayerTokens.delete(position.clientId);return;}
    const x=Number(position.x),y=Number(position.y),team=Number(position.team);if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(team)||team<0||team>=teamCount||x<0||y<0||x>=size||y>=size)return;
    remotePlayers.set(position.clientId,{...position,x,y,team});renderRemotePlayers();
  }
  function renderRemotePlayers(){
    const overlay=document.querySelector('#solver-overlays');for(const [id,position] of remotePlayers){let token=remotePlayerTokens.get(id);if(id===runActorId){token?.remove();remotePlayerTokens.delete(id);continue;}const route=routeData[position.team];if(!route)continue;if(!token){token=document.createElement('span');token.className='remote-player-token';token.setAttribute('aria-hidden','true');overlay.append(token);remotePlayerTokens.set(id,token);}token.style.setProperty('--team-color',route.color);Object.assign(token.style,boardPosition(position.x,position.y));token.textContent=route.id;}
  }
  function queuePositionBroadcast(position){pendingPosition=position;const elapsed=Date.now()-lastPositionBroadcast;if(elapsed>=300){clearTimeout(positionBroadcastTimer);positionBroadcastTimer=null;lastPositionBroadcast=Date.now();const latest=pendingPosition;pendingPosition=null;sendRoom('room-player',latest);return;}if(!positionBroadcastTimer)positionBroadcastTimer=setTimeout(()=>{positionBroadcastTimer=null;if(!pendingPosition||!roomReady)return;lastPositionBroadcast=Date.now();const latest=pendingPosition;pendingPosition=null;sendRoom('room-player',latest);},300-elapsed);}
  function sendMyPosition(){if(!roomReady||assignedTeamIndex<0)return;const ownRoute=routeData[assignedTeamIndex];const position=activeTeam===assignedTeamIndex?player:ownRoute;if(!position)return;queuePositionBroadcast({clientId:window.LabicompRoom.clientId,team:assignedTeamIndex,x:position.x,y:position.y,dir:position.dir});}

  function scheduleRoomRun(team,program,startAt,actorId=window.LabicompRoom?.clientId){
    if(busy||pendingRun||!Number.isFinite(startAt))return;const clean=sanitizeProgram(program);if(!clean)return;
    const runTeam=Math.max(0,Math.min(teamCount-1,Number(team)||0));activeTeam=runTeam;teamPrograms[runTeam]=clean;blocks=teamPrograms[runTeam];teamTitle.textContent=`Equipe ${runTeam+1} · Saída ${activeRoute().id}`;renderTeamSelectors();drawProgram();pendingRun=true;
    setTimeout(async()=>{pendingRun=false;if(busy)return;activeTeam=runTeam;blocks=teamPrograms[runTeam];runActorId=actorId||'';clearHighlights();resetTeamPlayer();setBusy(true);setStatus(`Executando em grupo: Equipe ${runTeam+1}.`);const result=await runSequence(blocks);rowNodes.forEach(node=>node.classList.remove('active'));setBusy(false);runActorId='';if(assignedTeamIndex>=0&&assignedTeamIndex<teamCount){activeTeam=assignedTeamIndex;blocks=teamPrograms[activeTeam];teamTitle.textContent=`Equipe ${activeTeam+1} · Saída ${activeRoute().id}`;renderTeamSelectors();resetTeamPlayer();}renderRemotePlayers();if(result==='goal')setStatus(`Sucesso! Equipe ${runTeam+1} alcançou o objetivo central.`,'success');else if(result==='done')setStatus(`A Equipe ${runTeam+1} terminou sem alcançar o centro.`,'error');},Math.max(0,startAt-Date.now()));
  }
  document.querySelector('#create-room').addEventListener('click',createRoom);
  document.querySelector('#join-room').addEventListener('click',joinRoom);
  document.querySelector('#room-code-input').addEventListener('input',event=>{event.currentTarget.value=event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);document.querySelector('#room-join-error').textContent='';});
  document.querySelector('#room-code-input').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();joinRoom();}});
  document.querySelector('#room-code-button').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);setStatus('Código da sala copiado.');}catch{setStatus(`Código da sala: ${roomCode}`);}});
  document.addEventListener('labicomp:room-request-state',()=>{if(roomRole==='host')broadcastRoomState(true);});
  document.addEventListener('labicomp:room-state',event=>{if(event.detail.sender!==window.LabicompRoom.clientId)applyRoomState(event.detail);});
  document.addEventListener('labicomp:presence',event=>{applyRoomPresence(Object.entries(event.detail.state||{}));});
  document.addEventListener('labicomp:room-player',event=>receiveRoomPlayer(event.detail));
  document.addEventListener('labicomp:room-request-players',()=>sendMyPosition());
  document.addEventListener('labicomp:room-run',event=>{const run=event.detail;if(roomReady&&run.seed===seedCode&&decodeSeedCode(run.seed)){runActorId=run.sender||'';renderRemotePlayers();scheduleRoomRun(Number(run.team),run.program,Number(run.startAt),runActorId);}});
  window.addEventListener('beforeunload',()=>{clearTimeout(positionBroadcastTimer);if(window.LabicompRoom)window.LabicompRoom.disconnect();});
  document.querySelector('#close-qr').addEventListener('click',()=>document.querySelector('#qr-dialog').close());
  const roomInvite=new URLSearchParams(location.search).get('room');
  if(roomInvite&&/^[A-Z0-9]{6}$/i.test(roomInvite)){document.querySelector('#welcome').hidden=false;joinRoom(roomInvite);}
  else document.querySelector('#welcome').hidden=false;

  function solveRoute(route){
    const start=keyOf(route.x,route.y),target=keyOf(goal.x,goal.y);const previous=new Map([[start,null]]);const queue=[start];
    for(let cursor=0;cursor<queue.length&&!previous.has(target);cursor++){const current=queue[cursor];const [x,y]=pointOf(current);for(const direction of dirs){const nx=x+direction.x,ny=y+direction.y,next=keyOf(nx,ny);if(previous.has(next)||!mazeGrid[ny]||mazeGrid[ny][nx]==='#')continue;previous.set(next,current);queue.push(next);}}
    if(!previous.has(target))return null;
    const path=[];for(let current=target;current!==start;current=previous.get(current))path.push(pointOf(current));path.reverse();
    const program=[];let facing=route.dir;let x=route.x,y=route.y;
    for(const [nextX,nextY] of path){const nextDir=dirs.findIndex(direction=>direction.x===nextX-x&&direction.y===nextY-y);const turn=(nextDir-facing+4)%4;if(turn===1)program.push({type:'right'});else if(turn===3)program.push({type:'left'});else if(turn===2)program.push({type:'left'},{type:'left'});program.push({type:'forward'});facing=nextDir;x=nextX;y=nextY;}
    return compressRepeatedActions(program);
  }
  function compressRepeatedActions(program){
    const compact=[];
    for(let index=0;index<program.length;){
      let end=index+1;while(end<program.length&&program[end].type===program[index].type)end++;
      let count=end-index;
      while(count>=2){const times=Math.min(20,count);compact.push({type:'loop',times,children:[{type:program[index].type}]});count-=times;}
      if(count===1)compact.push({type:program[index].type});
      index=end;
    }
    return compact;
  }
  function expandActions(list){return list.flatMap(block=>{
    if(block.type!=='loop')return[{type:block.type}];
    const body=expandActions(block.children);return Array.from({length:block.times},(_,repeat)=>body.map((action,index)=>({...action,inLoop:true,loopStart:repeat===0&&index===0,loopTimes:block.times,loopLabel:body.length===1?commandNames[body[0].type].toUpperCase():'BLOCO'}))).flat();
  });}
  function boardPosition(x,y){return{left:`${(x+.5)/size*100}%`,top:`${(y+.5)/size*100}%`};}
  function showMovementPopup(state,action){
    const popup=document.createElement('span');popup.className='solver-popup';popup.style.setProperty('--team-color',state.route.color);popup.style.setProperty('--team-stack',`${state.team*3}px`);Object.assign(popup.style,boardPosition(state.x,state.y));
    const actionLabel=action.type==='forward'?'↑ AVANÇAR':action.type==='left'?'↶ ESQUERDA':'↷ DIREITA';popup.textContent=action.loopStart?`↻ ${action.loopLabel} ×${action.loopTimes}`:actionLabel;popup.setAttribute('aria-label',`Equipe ${state.team+1}: ${action.loopStart?`repetir ${action.loopLabel.toLowerCase()} ${action.loopTimes} vezes`:commandNames[action.type]}`);
    const popups=state.popups||(state.popups=[]);popups.push(popup);if(popups.length>2)popups.shift().remove();popups.forEach((item,index)=>item.style.setProperty('--popup-stack',`${index*14}px`));document.querySelector('#solver-overlays').append(popup);
    setTimeout(()=>{popup.remove();const index=popups.indexOf(popup);if(index>=0)popups.splice(index,1);popups.forEach((item,slot)=>item.style.setProperty('--popup-stack',`${slot*14}px`));},1100);
  }
  function drawSolverToken(state){Object.assign(state.token.style,boardPosition(state.x,state.y));state.token.style.setProperty('--token-offset-x',`${(state.team%3-1)*8}px`);state.token.style.setProperty('--token-offset-y',`${(Math.floor(state.team/3)-1)*8}px`);state.token.textContent=state.route.id;}
  async function animateAllSolutions(){
    const overlay=document.querySelector('#solver-overlays');overlay.replaceChildren();remotePlayerTokens.clear();mazeEl.classList.add('solver-running');
    const states=solutionCache.map(solution=>{const route=routeData[solution.team];const token=document.createElement('span');token.className='solver-token';token.style.setProperty('--team-color',route.color);overlay.append(token);const state={team:solution.team,route,x:route.x,y:route.y,dir:route.dir,actions:expandActions(solution.blocks),index:0,token};drawSolverToken(state);return state;});
    const button=document.querySelector('#solve-all');simulatingAll=true;stopAllRequested=false;button.textContent='■ Parar demonstração';setBusy(true);setStatus(`As ${states.length} equipes começaram juntas.`);
    while(!stopAllRequested&&states.some(state=>state.index<state.actions.length)){
      for(const state of states){if(state.index>=state.actions.length)continue;const action=state.actions[state.index++];
        if(action.type==='left')state.dir=(state.dir+3)%4;else if(action.type==='right')state.dir=(state.dir+1)%4;else{state.x+=dirs[state.dir].x;state.y+=dirs[state.dir].y;}
        drawSolverToken(state);if(!action.inLoop||action.loopStart)showMovementPopup(state,action);
      }
      await sleep(90/demoSpeeds[demoSpeedIndex]);
    }
    await sleep(850);overlay.replaceChildren();remotePlayerTokens.clear();renderRemotePlayers();mazeEl.classList.remove('solver-running');setBusy(false);simulatingAll=false;button.textContent='▶ Assistir todas as equipes';
    setStatus(stopAllRequested?'Demonstração interrompida.':'Todas as equipes chegaram ao objetivo.',stopAllRequested?'':'success');stopAllRequested=false;
  }
  document.querySelector('#solve-all').addEventListener('click',()=>{
    if(simulatingAll){stopAllRequested=true;return;}if(busy)return;
    solutionCache=routeData.map((route,team)=>{const blocks=solveRoute(route);return{team,route:route.id,blocks};});
    if(solutionCache.some(solution=>!solution.blocks)){setStatus('Não foi possível encontrar um caminho para cada equipe.','error');return;}
    animateAllSolutions();
  });
  document.querySelector('#demo-speed').addEventListener('click',event=>{demoSpeedIndex=(demoSpeedIndex+1)%demoSpeeds.length;const speed=demoSpeeds[demoSpeedIndex];event.currentTarget.textContent=`${speed}×`;event.currentTarget.setAttribute('aria-label',`Velocidade da demonstração: ${speed}×. Clique para alterar.`);});
  document.querySelector('#show-qr').addEventListener('click',()=>{
    if(roomRole!=='host'||!roomCode)return;
    const dialog=document.querySelector('#qr-dialog');const image=document.querySelector('#qr-image');document.querySelector('#share-code').textContent=roomCode;
    if(!['http:','https:'].includes(location.protocol)){image.hidden=true;}
    else{const address=new URL(location.href);address.search='';address.hash='';address.searchParams.set('room',roomCode);image.hidden=false;image.src=`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(address.href)}`;}
    dialog.showModal();
  });
  document.querySelector('#close-qr').addEventListener('click',()=>document.querySelector('#qr-dialog').close());

  function expandedSteps(list){return list.reduce((sum,block)=>sum+(block.type==='loop'?block.times*expandedSteps(block.children):1),0);}
  function itemNode(block,path,number,removeCount=1){
    const item=document.createElement('div');item.className='program-item'+(block.type==='loop'?' loop':'');item.dataset.programPath=path;item.setAttribute('role','listitem');
    const num=document.createElement('span');num.className='num';num.textContent=String(number).padStart(2,'0');item.append(num);
    if(block.type==='loop'){
      const label=document.createElement('span');label.className='loop-title';label.append(document.createTextNode('Repetir '));
      const input=document.createElement('input');input.className='loop-input';input.type='number';input.min='2';input.max='20';input.step='1';input.value=String(block.times);input.dataset.loopPath=path;input.setAttribute('aria-label',`Número de repetições do laço ${number}`);input.disabled=busy;label.append(input,document.createTextNode(' vezes'));item.append(label);
    }else{const text=document.createElement('span');text.className='program-command';text.textContent=commandNames[block.type];item.append(text);}
    const remove=document.createElement('button');remove.className='remove';remove.type='button';remove.textContent='×';remove.dataset.removePath=path;remove.dataset.removeCount=String(removeCount);remove.disabled=busy;remove.setAttribute('aria-label',`Remover ${block.type==='loop'?'laço':commandNames[block.type]} da posição ${number}`);item.append(remove);rowNodes.set(path,item);return item;
  }
  function drawSequence(list,target,parentPath=''){
    for(let i=0;i<list.length;){
      const block=list[i],path=parentPath?`${parentPath}.${i}`:`${i}`;
      if(block.type==='loop'){
        const wrap=document.createElement('div');wrap.className='program-loop-wrap';wrap.append(itemNode(block,path,i+1));
        const children=document.createElement('div');children.className='program-children';children.setAttribute('role','group');children.setAttribute('aria-label',`Comandos dentro do laço de ${block.times} repetições`);drawSequence(block.children,children,path);wrap.append(children);target.append(wrap);i++;continue;
      }
      let end=i+1;while(end<list.length&&list[end].type===block.type)end++;
      const run=end-i,row=itemNode(block,path,i+1,run);
      if(run>1){const badge=document.createElement('span');badge.className='run-badge';badge.textContent=`×${run}`;badge.setAttribute('aria-label',`${run} comandos iguais agrupados`);row.insertBefore(badge,row.querySelector('.remove'));row.querySelector('.program-command').setAttribute('aria-label',`${commandNames[block.type]}, repetido ${run} vezes`);}
      target.append(row);i=end;
    }
  }
  function drawProgram(){
    programEl.replaceChildren();rowNodes=new Map();programEl.classList.toggle('empty',!blocks.length);
    if(!blocks.length){const empty=document.createElement('div');empty.className='program-empty';empty.textContent='Seu programa aparecerá aqui. Comece adicionando um bloco de movimento.';programEl.append(empty);}else drawSequence(blocks,programEl);
    if(failedPath)markFailedRow(failedPath);const total=expandedSteps(blocks);countEl.textContent=`${total} ${total===1?'passo':'passos'}`;
    updateActionAvailability();broadcastRoomState();
  }
  function setStatus(text,kind=''){
    statusEl.textContent=text;statusEl.className='status'+(kind?' '+kind:'');
    if(!text||kind!=='error')return;
    const container=document.querySelector('#toast-container');
    const now=Date.now();
    if(activeToast?.isConnected&&!activeToast.classList.contains('toast-leaving')&&now-activeToast._lastAdded<850){
      addToastItem(activeToast,text);
      activeToast._lastAdded=now;
      updateToastTone(activeToast,kind);
      clearTimeout(activeToast._dismissTimer);
      activeToast._dismissTimer=setTimeout(()=>dismissToast(activeToast),2200);
      clearTimeout(toastGroupTimer);
      toastGroupTimer=setTimeout(()=>{activeToast=null;},850);
      return;
    }
    const toast=document.createElement('div');toast.className='toast';toast.setAttribute('role','status');toast.dataset.toastId=String(++toastId);toast._lastAdded=now;toast._tone='';
    const icon=document.createElement('span');icon.className='toast-icon';icon.setAttribute('aria-hidden','true');
    const count=document.createElement('span');count.className='toast-count';count.textContent='1';count.setAttribute('aria-label','1 notificação');
    const close=document.createElement('button');close.className='toast-close';close.type='button';close.setAttribute('aria-label','Dispensar notificações');close.textContent='×';
    const items=document.createElement('ul');items.className='toast-items';
    toast.append(icon,count,close,items);container.append(toast);
    addToastItem(toast,text);updateToastTone(toast,kind);
    close.addEventListener('click',()=>dismissToast(toast));
    while(container.children.length>4){const oldest=container.firstElementChild;if(oldest===toast)break;dismissToast(oldest,true);}
    toast._dismissTimer=setTimeout(()=>dismissToast(toast),2200);
    activeToast=toast;clearTimeout(toastGroupTimer);toastGroupTimer=setTimeout(()=>{if(activeToast===toast)activeToast=null;},850);
  }
  function addToastItem(toast,text){
    const items=toast.querySelector('.toast-items');const item=document.createElement('li');item.className='toast-item';item.textContent=text;items.append(item);
    const count=items.children.length;const counter=toast.querySelector('.toast-count');counter.textContent=String(count);counter.setAttribute('aria-label',`${count} ${count===1?'notificação':'notificações'}`);
  }
  function updateToastTone(toast,kind){
    const rank={error:3,success:2,'':1};const previous=toast._tone||'';
    if((rank[kind]||1)>=(rank[previous]||1))toast._tone=kind;
    toast.classList.toggle('success',toast._tone==='success');toast.classList.toggle('error',toast._tone==='error');
    const icon=toast.querySelector('.toast-icon');icon.textContent=toast._tone==='success'?'✓':toast._tone==='error'?'!':'i';
  }
  function dismissToast(toast,immediate=false){
    if(!toast?.isConnected)return;clearTimeout(toast._dismissTimer);if(activeToast===toast)activeToast=null;
    if(immediate){toast.remove();return;}
    toast.classList.add('toast-leaving');toast.addEventListener('animationend',()=>toast.remove(),{once:true});setTimeout(()=>toast.remove(),350);
  }
  function updateActionAvailability(){const locked=busy||(roomReady&&assignedTeamIndex<0);document.querySelectorAll('[data-add]').forEach(button=>button.disabled=locked);document.querySelector('#run').disabled=locked;document.querySelector('#solve-all').disabled=locked;document.querySelector('#repeat').disabled=locked||blocks.length<1;document.querySelector('#clear').disabled=locked||blocks.length===0;document.querySelector('#new-maze').disabled=busy;teamPickerToggle.disabled=busy;}
  function setBusy(value){busy=value;renderTeamSelectors();updateActionAvailability();drawProgram();}
  function markFailedRow(path){const row=rowNodes.get(path);if(!row)return;row.classList.add('failed');if(!row.querySelector('.error-badge')){const badge=document.createElement('span');badge.className='error-badge';badge.textContent='ERRO';badge.setAttribute('aria-hidden','true');row.insertBefore(badge,row.querySelector('.remove'));}}
  function clearHighlights(){failedPath=null;rowNodes.forEach(row=>row.classList.remove('active','failed'));programEl.querySelectorAll('.error-badge').forEach(badge=>badge.remove());}
  function add(type){if(busy||(roomReady&&assignedTeamIndex<0))return;clearHighlights();blocks.push({type});drawProgram();setStatus(`${commandNames[type]} adicionado à sequência.`);}
  document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>add(button.dataset.add)));
  document.querySelector('#repeat').addEventListener('click',()=>{if(busy||(roomReady&&assignedTeamIndex<0)||!blocks.length)return;clearHighlights();const child=blocks.pop();blocks.push({type:'loop',times:2,children:[child]});drawProgram();setStatus('Laço criado. Ajuste o número de repetições no próprio bloco.');programEl.querySelector(`[data-loop-path="${blocks.length-1}"]`)?.focus();});
  programEl.addEventListener('change',event=>{const input=event.target.closest('.loop-input');if(!input||busy||(roomReady&&assignedTeamIndex<0))return;const path=input.dataset.loopPath;const block=getBlock(path);if(!block||block.type!=='loop')return;const times=Math.max(2,Math.min(20,Number(input.value)||2));clearHighlights();block.times=times;drawProgram();setStatus(`Laço atualizado para ${times} repetições.`);programEl.querySelector(`[data-loop-path="${path}"]`)?.focus();});
  function getBlock(path){let list=blocks;let block;for(const index of path.split('.').map(Number)){block=list[index];if(!block)return null;list=block.type==='loop'?block.children:[];}return block;}
  function getParentAndIndex(path){const indices=path.split('.').map(Number);const index=indices.pop();let list=blocks;for(const part of indices){const parent=list[part];if(!parent||parent.type!=='loop')return null;list=parent.children;}return{list,index};}
  programEl.addEventListener('click',event=>{const button=event.target.closest('[data-remove-path]');if(!button||busy||(roomReady&&assignedTeamIndex<0))return;event.preventDefault();event.stopPropagation();const target=getParentAndIndex(button.dataset.removePath);if(!target)return;const start=target.index,amount=Number(button.dataset.removeCount)||1;clearHighlights();target.list.splice(start,amount);drawProgram();setStatus(amount>1?`${amount} comandos repetidos removidos.`:'Bloco removido da sequência.');(programEl.querySelector('.remove')||document.querySelector('[data-add="forward"]'))?.focus();});
  document.querySelector('#clear').addEventListener('click',()=>{if(busy||(roomReady&&assignedTeamIndex<0))return;clearHighlights();blocks=[];drawProgram();setStatus('Sequência apagada. Você pode montar um novo programa.');document.querySelector('[data-add="forward"]').focus();});
  async function runBlock(block,path){
    rowNodes.forEach(node=>node.classList.remove('active'));const row=rowNodes.get(path);row?.classList.add('active');
    if(block.type==='loop'){
      for(let repeat=0;repeat<block.times;repeat++)for(let i=0;i<block.children.length;i++){const result=await runBlock(block.children[i],`${path}.${i}`);if(result!=='ok')return result;}
      return player.x===goal.x&&player.y===goal.y?'goal':'ok';
    }
    if(block.type==='left')player.dir=(player.dir+3)%4;if(block.type==='right')player.dir=(player.dir+1)%4;
    if(block.type==='forward'){
      const next={x:player.x+dirs[player.dir].x,y:player.y+dirs[player.dir].y};const value=mazeGrid[next.y]?.[next.x];
      if(value===undefined||value==='#'||value===' '){row?.classList.remove('active');failedPath=path;markFailedRow(path);setStatus(`Erro no bloco ${Number(path.split('.').at(-1))+1}: Avançar encontrou uma barreira na linha ${player.y+1}, coluna ${player.x+1}. O programa parou. Ajuste ou remova o bloco destacado.`,'error');return'blocked';}
      player.x=next.x;player.y=next.y;
    }
    updateExplorer();await sleep(140);return player.x===goal.x&&player.y===goal.y?'goal':'ok';
  }
  async function runSequence(list,parentPath=''){for(let i=0;i<list.length;i++){const path=parentPath?`${parentPath}.${i}`:`${i}`;const result=await runBlock(list[i],path);if(result!=='ok')return result;}return'done';}
  document.querySelector('#run').addEventListener('click',async()=>{
    if(busy||(roomReady&&assignedTeamIndex<0))return;if(!blocks.length){setStatus('Adicione pelo menos um bloco antes de executar.','error');document.querySelector('[data-add="forward"]').focus();return;}
    clearHighlights();resetTeamPlayer();
    if(roomReady){const startAt=Date.now()+1200;const program=sanitizeProgram(blocks);await sendRoom('room-run',{seed:seedCode,team:activeTeam,program,startAt});scheduleRoomRun(activeTeam,program,startAt);return;}
    setBusy(true);setStatus(`Executando o algoritmo da Equipe ${activeTeam+1} pela saída ${activeRoute().id}.`);
    const runTeam=activeTeam;const result=await runSequence(blocks);rowNodes.forEach(node=>node.classList.remove('active'));setBusy(false);
    if(result==='goal')setStatus(`Sucesso! Equipe ${runTeam+1} alcançou o objetivo central.`,'success');else if(result==='done')setStatus(`O programa da Equipe ${runTeam+1} terminou sem alcançar o centro. Revise a sequência.`,'error');
  });
  document.querySelector('#theme-toggle').addEventListener('click',()=>{const root=document.documentElement;const dark=root.dataset.theme!=='dark';root.dataset.theme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]').content=dark?'#1b1a18':'#f4f1ec';setStatus(dark?'Tema escuro ativado.':'Tema claro ativado.');if(window.KoiPond?.kick)window.KoiPond.kick();});
})();
