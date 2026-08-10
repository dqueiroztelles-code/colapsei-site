const ROUTES = new Set(['collapsei','cresci','alguem','sistema','reconstruir']);
const MAX = { name:120, email:254, answer:80, title:220, url:1000, text:1800 };

function clean(value, max=MAX.text){
  return String(value ?? '').trim().slice(0,max);
}
function validEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= MAX.email; }
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function snapshot(raw={}){
  const priorities = Array.isArray(raw.priorities) ? raw.priorities.slice(0,3).map(p => ({title:clean(p?.title,180),body:clean(p?.body,800)})) : [];
  const questions = Array.isArray(raw.questions) ? raw.questions.slice(0,6).map(q=>clean(q,400)) : [];
  const checklist = Array.isArray(raw.checklist) ? raw.checklist.slice(0,12).map(q=>clean(q,240)) : [];
  return {title:clean(raw.title,MAX.title),lead:clean(raw.lead,1000),summary:clean(raw.summary,1200),priorities,questions,checklist,orientation:clean(raw.orientation,1200),next_title:clean(raw.next_title,MAX.title)};
}
function emailHtml({name, result, siteUrl, contactUrl}){
  const first = escapeHtml(name.split(/\s+/)[0] || '');
  const priorities = result.priorities.map((p,i)=>`<tr><td style="padding:16px 0;border-top:1px solid #d9d0c2;vertical-align:top;width:38px;font:600 12px Arial,sans-serif;color:#0f6b4c">0${i+1}</td><td style="padding:16px 0;border-top:1px solid #d9d0c2"><div style="font:600 17px Arial,sans-serif;color:#17150f">${escapeHtml(p.title)}</div><div style="margin-top:6px;font:14px/1.55 Arial,sans-serif;color:#5d584f">${escapeHtml(p.body)}</div></td></tr>`).join('');
  const questions = result.questions.slice(0,4).map(q=>`<li style="margin:0 0 9px">${escapeHtml(q)}</li>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f7ecd8;color:#17150f"><div style="max-width:680px;margin:auto;padding:44px 24px;font-family:Arial,sans-serif"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em">COLAPSEI. E AGORA? · MAPA DO COLAPSO</div><h1 style="font:500 42px/1.02 Georgia,serif;margin:28px 0 18px">${first ? first + ', seu Mapa está pronto.' : 'Seu Mapa está pronto.'}</h1><p style="font:17px/1.65 Arial,sans-serif;color:#5d584f">${escapeHtml(result.lead)}</p><div style="margin:30px 0;padding:24px;background:#17150f;color:#f7ecd8"><div style="font:600 11px Arial,sans-serif;letter-spacing:.12em;color:#b9d92e">SEU PONTO DE PARTIDA</div><h2 style="font:500 30px/1.05 Georgia,serif;margin:12px 0">${escapeHtml(result.title)}</h2><p style="font:15px/1.65 Arial,sans-serif;color:#ded5c7">${escapeHtml(result.summary)}</p></div><h2 style="font:500 28px Georgia,serif;margin:36px 0 8px">O que parece vir primeiro</h2><table role="presentation" style="width:100%;border-collapse:collapse">${priorities}</table><h2 style="font:500 28px Georgia,serif;margin:36px 0 14px">Perguntas que vale responder</h2><ul style="padding-left:20px;font:14px/1.55 Arial,sans-serif;color:#5d584f">${questions}</ul><p style="margin:36px 0 12px"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#b9d92e;color:#17150f;text-decoration:none;padding:14px 20px;border-radius:999px;font-weight:700">Ver o Mapa no site →</a></p><div style="margin-top:42px;padding-top:28px;border-top:1px solid #d9d0c2"><h2 style="font:500 28px Georgia,serif;margin:0 0 10px">Quer ajuda para organizar isso?</h2><p style="font:14px/1.6 Arial,sans-serif;color:#5d584f">A Dulce pode ajudar a organizar informações, perguntas, responsabilidades e próximos passos. Não é terapia nem atendimento clínico. É navegação.</p><a href="${escapeHtml(contactUrl)}" style="font-weight:700;color:#0f6b4c">Falar com a Dulce →</a></div><p style="margin-top:44px;font:11px/1.55 Arial,sans-serif;color:#7b7468">O Mapa do Colapso organiza informações e próximos passos. Não realiza diagnóstico, não indica tratamento, não orienta medicação e não substitui profissionais habilitados ou serviços de emergência.</p></div></body></html>`;
}

module.exports = async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = clean(body.name,MAX.name);
    const email = clean(body.email,MAX.email).toLowerCase();
    const route = clean(body.route,40);
    const privacyVersion = clean(body.privacy_version,80);
    const answers = [clean(body.answer_1,MAX.answer),clean(body.answer_2,MAX.answer),clean(body.answer_3,MAX.answer)];
    if(!name || !validEmail(email) || !ROUTES.has(route) || !privacyVersion || answers.some(a=>!a) || body.privacy_ack !== true){
      return res.status(400).json({error:'Dados obrigatórios inválidos.'});
    }
    const result = snapshot(body.result_snapshot);
    if(!result.title || result.priorities.length !== 3) return res.status(400).json({error:'Resultado incompleto.'});

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!supabaseUrl || !serviceKey){
      return res.status(503).json({error:'Banco ainda não configurado neste ambiente.',saved:false,email_sent:false});
    }
    const dbHeaders = {'Content-Type':'application/json','apikey':serviceKey,'Authorization':`Bearer ${serviceKey}`};
    const now = new Date().toISOString();

    // Reutiliza o contato pelo e-mail. Um checkbox de marketing desmarcado não apaga consentimento anterior.
    const lookupResp = await fetch(`${supabaseUrl}/rest/v1/contacts?email=eq.${encodeURIComponent(email)}&select=id,marketing_consent&limit=1`,{
      method:'GET',headers:{...dbHeaders,'Accept':'application/json'}
    });
    if(!lookupResp.ok) throw new Error(`Falha ao consultar contato (${lookupResp.status}).`);
    const existing = (await lookupResp.json())[0] || null;
    let contactId;

    if(existing?.id){
      const update = {name,privacy_ack_at:now,updated_at:now};
      if(body.marketing_consent === true){
        update.marketing_consent = true;
        if(!existing.marketing_consent) update.marketing_consented_at = now;
      }
      const contactResp = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${encodeURIComponent(existing.id)}`,{
        method:'PATCH',headers:{...dbHeaders,'Prefer':'return=minimal'},body:JSON.stringify(update)
      });
      if(!contactResp.ok) throw new Error(`Falha ao atualizar contato (${contactResp.status}).`);
      contactId = existing.id;
    }else{
      const contactResp = await fetch(`${supabaseUrl}/rest/v1/contacts`,{
        method:'POST',headers:{...dbHeaders,'Prefer':'return=representation'},
        body:JSON.stringify({name,email,marketing_consent:body.marketing_consent===true,marketing_consented_at:body.marketing_consent===true?now:null,privacy_ack_at:now,updated_at:now})
      });
      if(!contactResp.ok) throw new Error(`Falha ao salvar contato (${contactResp.status}).`);
      const contact = (await contactResp.json())[0];
      contactId = contact?.id;
      if(!contactId) throw new Error('Contato não retornou ID.');
    }

    // Minimizamos persistência: não gravamos o texto completo do resultado, apenas categorias/IDs estruturados.
    const session = {
      contact_id:contactId,map_version:clean(body.map_version,80),privacy_version:privacyVersion,route,
      answer_1:answers[0],answer_2:answers[1],answer_3:answers[2],result_title:result.title,
      utm_source:clean(body.utm_source,160),utm_medium:clean(body.utm_medium,160),utm_campaign:clean(body.utm_campaign,160),
      referrer:clean(body.source,MAX.url),page_url:clean(body.page_url,MAX.url),email_status:'pending'
    };
    const sessionResp = await fetch(`${supabaseUrl}/rest/v1/map_sessions`,{
      method:'POST',headers:{...dbHeaders,'Prefer':'return=representation'},body:JSON.stringify(session)
    });
    if(!sessionResp.ok) throw new Error(`Falha ao salvar sessão (${sessionResp.status}).`);
    const sessionId=(await sessionResp.json())[0]?.id;

    let emailSent=false;
    const resendKey=process.env.RESEND_API_KEY;
    const from=process.env.MAPA_FROM_EMAIL;
    const proto=clean(req.headers['x-forwarded-proto'] || 'https',20);
    const host=clean(req.headers.host || '',255);
    const origin=host?`${proto}://${host}`:'https://colapsei-site.vercel.app';
    const siteUrl=process.env.MAPA_SITE_URL || `${origin}/mapa`;
    const contactUrl=process.env.DULCE_CONTACT_URL || `${origin}/?origem=mapa&rota=${encodeURIComponent(route)}#contato`;

    if(resendKey && from){
      const mailPayload={from,to:[email],subject:'Seu Mapa está pronto.',html:emailHtml({name,result,siteUrl,contactUrl})};
      if(process.env.MAPA_REPLY_TO) mailPayload.reply_to=process.env.MAPA_REPLY_TO;
      const mailResp=await fetch('https://api.resend.com/emails',{
        method:'POST',headers:{'Authorization':`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify(mailPayload)
      });
      emailSent=mailResp.ok;
      if(!mailResp.ok) console.error('mapa_email_error',mailResp.status,await mailResp.text().catch(()=>''));
    }

    if(sessionId){
      await fetch(`${supabaseUrl}/rest/v1/map_sessions?id=eq.${encodeURIComponent(sessionId)}`,{
        method:'PATCH',headers:{...dbHeaders,'Prefer':'return=minimal'},
        body:JSON.stringify({email_status:emailSent?'sent':(resendKey&&from?'failed':'pending'),email_sent_at:emailSent?new Date().toISOString():null})
      });
    }

    return res.status(200).json({saved:true,email_sent:emailSent,session_id:sessionId||null});
  }catch(error){
    console.error('mapa_submit_error',error);
    return res.status(500).json({error:'Não foi possível concluir o envio agora.',saved:false,email_sent:false});
  }
};
