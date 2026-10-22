// This is a browser publishable key, not a secret or service_role key.
export const cloudConfig = Object.freeze({
 url: 'https://gdrdfhrqclbandeopqge.supabase.co',
 publishableKey: 'sb_publishable_987MvvpOiICZ5tMm5AhcfQ_ZsLqa6rK'
});

export function createCloudApi(config, request = globalThis.fetch.bind(globalThis)) {
 const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 return async function cloudApi(url, options = {}) {
  const method = options.method || 'GET';
  const data = options.body ? JSON.parse(options.body) : {};
  const parts = url.split('/').filter(Boolean);
  let rpc, args;
  if (url === '/api/boards' && method === 'POST') {
   rpc = 'oiocha_create_board'; args = {p_title:data.title,p_recipient:data.recipient};
  } else {
   const boardId = parts[2];
   if (parts[0] !== 'api' || parts[1] !== 'boards' || !uuid.test(boardId || '')) throw Error('찻잔 링크를 확인해 주세요.');
   if (parts.length === 3 && method === 'GET') {
    rpc = 'oiocha_get_board'; args = {p_board_id:boardId};
   } else if (parts.length === 4 && parts[3] === 'messages' && method === 'POST') {
    rpc = 'oiocha_add_message'; args = {p_board_id:boardId,p_name:data.name,p_body:data.body,p_shape:data.shape,p_x:data.x,p_y:data.y};
   } else if (parts.length === 5 && parts[3] === 'messages' && uuid.test(parts[4]) && method === 'PATCH') {
    rpc = 'oiocha_move_message'; args = {p_board_id:boardId,p_message_id:parts[4],p_x:data.x,p_y:data.y};
   } else throw Error('지원하지 않는 요청입니다.');
  }
  let response;
  try {
   response = await request(config.url + '/rest/v1/rpc/' + rpc, {
    method:'POST', headers:{apikey:config.publishableKey,'Content-Type':'application/json'},
    body:JSON.stringify(args), signal:AbortSignal.timeout(20000), cache:'no-store'
   });
  } catch { throw Error('저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'); }
  let result;
  try { result = await response.json(); } catch { throw Error('저장소 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  if (!response.ok) {
   if (result.code === 'PGRST202' || result.code === '42501') throw Error('온라인 저장 설정이 아직 완료되지 않았어요. 운영자에게 문의해 주세요.');
   if (['22023','P0001','P0002'].includes(result.code)) throw Error(result.message);
   throw Error('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  if (!result || typeof result !== 'object') throw Error('저장소 응답을 확인하지 못했어요.');
  return result;
 };
}
