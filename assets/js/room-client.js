(() => {
  const config=window.LABICOMP_SUPABASE_CONFIG||{};
  const clientId=globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  let client=null;
  let channel=null;
  let roomCode='';
  const events=['room-request-state','room-state','room-program','room-run','room-start','room-stop','room-player','room-request-players'];
  let presenceData=null;
  function emit(name,detail){document.dispatchEvent(new CustomEvent(`labicomp:${name}`,{detail}));}
  function configured(){return Boolean(config.url&&config.publishableKey&&window.supabase?.createClient);}
  async function connect(code,role){
    if(!configured())throw new Error('Configure a URL do projeto e a chave publishable do Supabase em assets/js/supabase-config.js.');
    await disconnect();
    client=window.supabase.createClient(config.url,config.publishableKey,{realtime:{params:{eventsPerSecond:20}}});
    roomCode=code;
    channel=client.channel(`labicomp-room:${code}`,{config:{broadcast:{self:false},presence:{key:clientId},private:false}});
    for(const event of events)channel.on('broadcast',{event},message=>emit(event,message.payload));
    channel.on('presence',{event:'sync'},()=>emit('presence',{state:channel.presenceState()}));
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('O Supabase demorou para conectar. Verifique a rede e tente novamente.')),12000);
      channel.subscribe(status=>{
        if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){clearTimeout(timer);reject(new Error('Não foi possível conectar à sala no Supabase.'))}
      });
    });
    presenceData={clientId,role,joinedAt:Date.now(),teamIndex:role==='host'?0:null,spectating:false};
    await channel.track(presenceData);
    return{clientId,roomCode};
  }
  async function updatePresence(patch){
    if(!channel||!presenceData)return;
    Object.assign(presenceData,patch);
    await channel.track(presenceData);
  }
  async function send(event,payload){
    if(!channel)throw new Error('Não há uma sala conectada.');
    const result=await channel.send({type:'broadcast',event,payload:{...payload,sender:clientId}});
    if(result==='error')throw new Error('O Supabase não aceitou a mensagem da sala.');
    return result;
  }
  async function disconnect(){
    const oldClient=client,oldChannel=channel;
    client=null;channel=null;roomCode='';presenceData=null;
    if(oldClient&&oldChannel)await oldClient.removeChannel(oldChannel);
  }
  window.LabicompRoom={configured,connect,send,updatePresence,disconnect,get clientId(){return clientId;},get roomCode(){return roomCode;}};
})();
