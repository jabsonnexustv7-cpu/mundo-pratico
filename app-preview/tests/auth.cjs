// Run with Node.js + Playwright. API requests are intercepted: no emails or database writes.
const { chromium } = require(process.env.MP_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sdkURL = 'https://esm.sh/@supabase/supabase-js@2.116.0?target=es2022';
const authKey = 'sb-uajdfknjuqhntopkbral-auth-token';
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'cliente@example.test', app_metadata: { provider: 'email' }, user_metadata: {} };
function session(account = user, expired = false) {
  const now = Math.floor(Date.now() / 1000) - (expired ? 7200 : 0);
  const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
    Buffer.from(JSON.stringify({sub:account.id,email:account.email,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})).toString('base64url'),
    'synthetic-test-signature'].join('.');
  return { access_token:token,refresh_token:'synthetic-test-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer',user:account };
}
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/app-preview/')) { res.writeHead(404);res.end();return; }
  const file = path.resolve(root, '.' + url.pathname.slice('/app-preview'.length));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'content-type':types[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res);
});
let browser,base;
const passed=[];
async function test(name, fn) {await fn();passed.push(name);console.log('PASS '+name);}
async function setup(options = {}) {
  const ctx=await browser.newContext({viewport:{width:options.width||390,height:844},serviceWorkers:'block'});
  const page=await ctx.newPage();
  const calls=[];const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(({key,saved})=>{
    localStorage.setItem('mp-preview-profile-v1','preferences-must-survive');
    localStorage.setItem('crm-unrelated','do-not-clear');
    if(saved)localStorage.setItem(key,JSON.stringify(saved));
  },{key:authKey,saved:options.saved});
  await ctx.route('https://uajdfknjuqhntopkbral.supabase.co/**',async route=>{
    const request=route.request();const url=new URL(request.url());
    calls.push({path:url.pathname,method:request.method(),body:request.postDataJSON(),url:request.url(),headers:request.headers()});
    if(options.handle && await options.handle(route,request,url,calls))return;
    let body;
    if(url.pathname==='/auth/v1/user')body=options.currentUser||user;
    else if(url.pathname==='/auth/v1/otp')body={};
    else if(url.pathname==='/auth/v1/logout')body={};
    else if(url.pathname==='/rest/v1/rpc/mp_claim_entitlements')body=options.claim??0;
    else if(url.pathname==='/rest/v1/rpc/mp_has_active_access')body=options.access??true;
    else if(url.pathname==='/rest/v1/mp_profiles')body=null;
    else throw Error('Unexpected Supabase request '+url.pathname);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  if(options.sdkFail)await ctx.route(sdkURL,r=>r.abort());
  return {ctx,page,calls,errors};
}
async function state(page,name) {await page.locator('#state'+name+'.is-active').waitFor();}
async function errorResponse(route, status=400) {await route.fulfill({status,contentType:'application/json',body:JSON.stringify({code:'synthetic_error',message:'RAW TECHNICAL ERROR MUST NOT APPEAR'})});}
async function close(t) {assert.deepEqual(t.errors,[]);await t.ctx.close();}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}/app-preview/acesso.html`;
  browser=await chromium.launch({channel:process.env.MP_BROWSER_CHANNEL||'msedge',headless:true});
  try {
    await test('login, validation, OTP single-flight, resend, change email; real SDK',async()=>{
      let release;
      const t=await setup({handle:async(route,req,url)=>{
        if(url.pathname!=='/auth/v1/otp')return false;
        await new Promise(resolve=>release=resolve);
        await route.fulfill({status:200,contentType:'application/json',body:'{}'});return true;
      }});
      await t.page.goto(base);await state(t.page,'Login');
      await t.page.locator('#email').fill('invalid');await t.page.locator('#sendButton').click();
      assert.match(await t.page.locator('#formError').textContent(),/e-mail válido/);
      assert.equal(t.calls.length,0);
      await t.page.locator('#email').fill(' Cliente@Example.Test ');
      await t.page.locator('#loginForm').evaluate(f=>{f.requestSubmit();f.requestSubmit();f.requestSubmit()});
      await t.page.waitForFunction(()=>document.querySelector('#sendButton').disabled);
      while(!release)await t.page.waitForTimeout(10);
      assert.equal(t.calls.filter(c=>c.path==='/auth/v1/otp').length,1);
      const otp=t.calls[0];assert.equal(otp.body.email,user.email);assert.equal(otp.body.create_user,true);
      assert.equal(new URL(otp.url).searchParams.get('redirect_to'),'https://mundopraticodigital.com.br/app-preview/acesso.html');
      release();await state(t.page,'Sent');assert.equal(await t.page.locator('#sentEmail').textContent(),user.email);
      assert.equal(t.page.url(),base);
      release=null;await t.page.locator('#resendButton').click();
      while(!release)await t.page.waitForTimeout(10);
      release();await t.page.waitForFunction(()=>!document.querySelector('#resendButton').disabled);
      assert.equal(t.calls.filter(c=>c.path==='/auth/v1/otp').length,2);
      await t.page.locator('#changeEmailButton').click();await state(t.page,'Login');
      assert.equal(await t.page.locator('#email').inputValue(),'');await close(t);
    });
    for(const width of [1440,390,320])await test(`existing session: claim=0, access=true, profile preserved; ${width}px`,async()=>{
      const t=await setup({saved:session(),width});await t.page.goto(base);await state(t.page,'Granted');
      assert.equal(await t.page.locator('#grantedEmail').textContent(),user.email);
      assert.equal(await t.page.locator('#stateGranted .primary-button').getAttribute('href'),'./');
      assert.deepEqual(t.calls.map(c=>c.path),['/auth/v1/user','/rest/v1/rpc/mp_claim_entitlements','/rest/v1/rpc/mp_has_active_access','/rest/v1/mp_profiles']);
      const profile=t.calls[3];assert.deepEqual(profile.body,{user_id:user.id});
      assert.match(profile.headers.prefer,/resolution=ignore-duplicates/);
      assert(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const screenshots=process.env.MP_AUTH_SCREENSHOTS;
      if(screenshots){await t.page.waitForTimeout(300);await t.page.screenshot({path:path.join(screenshots,`auth-${width}-granted.png`),fullPage:true});}
      await close(t);
    });
    await test('Magic Link callback: processed session, clean URL, repeat sign-in deduplicated',async()=>{
      const saved=session();const t=await setup();
      await t.page.goto(base+'#'+new URLSearchParams({access_token:saved.access_token,refresh_token:saved.refresh_token,expires_in:'3600',token_type:'bearer',type:'magiclink'}));
      await state(t.page,'Granted');assert.equal(t.page.url(),base);
      assert(await t.page.evaluate(key=>!!JSON.parse(localStorage.getItem(key)).access_token,authKey));
      // The SDK broadcasts repeated SIGNED_IN events on tab refocus. Exercise its public setSession API.
      await t.page.evaluate(async ({url,saved})=>{
        const sdk=await import(url);
        const c=sdk.createClient('https://uajdfknjuqhntopkbral.supabase.co','sb_publishable_synthetic-test',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
        await c.auth.setSession({access_token:saved.access_token,refresh_token:saved.refresh_token});
      },{url:sdkURL,saved});
      await t.page.waitForTimeout(200);
      assert.equal(t.calls.filter(c=>c.path==='/rest/v1/rpc/mp_claim_entitlements').length,1);
      await close(t);
    });
    await test('no active purchase: specific denial, no profile write, logout preserves preferences',async()=>{
      const t=await setup({saved:session(),access:false});await t.page.goto(base);await state(t.page,'Denied');
      assert.equal(await t.page.locator('#deniedEmail').textContent(),user.email);
      assert.equal(t.calls.filter(c=>c.path==='/rest/v1/mp_profiles').length,0);
      await t.page.getByRole('button',{name:'Sair',exact:true}).click();await state(t.page,'Login');
      const logout=t.calls.find(c=>c.path==='/auth/v1/logout');assert.equal(new URL(logout.url).searchParams.get('scope'),'local');
      assert.equal(await t.page.evaluate(key=>localStorage.getItem(key),authKey),null);
      assert.equal(await t.page.evaluate(()=>localStorage.getItem('mp-preview-profile-v1')),'preferences-must-survive');
      assert.equal(await t.page.evaluate(()=>localStorage.getItem('crm-unrelated')),'do-not-clear');
      await close(t);
    });
    await test('new session on the open page triggers claim/check automatically',async()=>{
      const saved=session();const t=await setup();await t.page.goto(base);await state(t.page,'Login');
      await t.page.evaluate(async({url,saved})=>{
        const sdk=await import(url);const c=sdk.createClient('https://uajdfknjuqhntopkbral.supabase.co','sb_publishable_synthetic-test',{auth:{autoRefreshToken:false,detectSessionInUrl:false}});
        await c.auth.setSession({access_token:saved.access_token,refresh_token:saved.refresh_token});
      },{url:sdkURL,saved});
      await state(t.page,'Granted');assert.equal(t.calls.filter(c=>c.path==='/rest/v1/rpc/mp_claim_entitlements').length,1);await close(t);
    });
    await test('logout during access RPC cannot restore stale granted state',async()=>{
      let release;
      const t=await setup({saved:session(),handle:async(r,req,u)=>{
        if(u.pathname!=='/rest/v1/rpc/mp_has_active_access')return false;
        await new Promise(resolve=>release=resolve);await r.fulfill({status:200,contentType:'application/json',body:'true'});return true;
      }});
      await t.page.goto(base);while(!release)await t.page.waitForTimeout(10);
      await t.page.evaluate(async url=>{
        const sdk=await import(url);const c=sdk.createClient('https://uajdfknjuqhntopkbral.supabase.co','sb_publishable_synthetic-test',{auth:{autoRefreshToken:false,detectSessionInUrl:false}});
        await c.auth.signOut({scope:'local'});
      },sdkURL);
      await state(t.page,'Login');release();await t.page.waitForTimeout(200);
      assert.equal(await t.page.locator('#stateGranted').evaluate(e=>e.classList.contains('is-active')),false);
      assert.equal(t.calls.filter(c=>c.path==='/rest/v1/mp_profiles').length,0);await close(t);
    });
    for(const [endpoint,message] of [
      ['/auth/v1/user','Sua sessão é inválida ou expirou'],
      ['/rest/v1/rpc/mp_claim_entitlements','vincular sua compra'],
      ['/rest/v1/rpc/mp_has_active_access','verificar se sua compra'],
      ['/rest/v1/mp_profiles','preparar seu perfil'],
    ])await test('distinct error and retry: '+endpoint,async()=>{
      let fail=true;
      const t=await setup({saved:session(),handle:async(r,req,u)=>{if(u.pathname===endpoint&&fail){await errorResponse(r);return true;}return false;}});
      await t.page.goto(base);await state(t.page,'Error');
      assert.match(await t.page.locator('#fatalError').textContent(),new RegExp(message));
      assert(! (await t.page.locator('#fatalError').textContent()).includes('RAW'));
      fail=false;await t.page.locator('#retryButton').click();await state(t.page,'Granted');await close(t);
    });
    await test('expired callback is cleaned and allows another email',async()=>{
      const t=await setup();await t.page.goto(base+'?error=access_denied&error_description=RAW%25ERROR#error_code=otp_expired');
      await state(t.page,'Error');assert.equal(t.page.url(),base);
      await t.page.locator('#stateError [data-signout]').click();await state(t.page,'Login');await close(t);
    });
    await test('expired stored session with invalid refresh token reports session error',async()=>{
      const t=await setup({saved:session(user,true),handle:async(r,req,u)=>{
        if(u.pathname!=='/auth/v1/token')return false;
        await r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'refresh_token_not_found',message:'Synthetic invalid refresh token'})});return true;
      }});
      await t.page.goto(base);await state(t.page,'Error');
      assert.match(await t.page.locator('#fatalError').textContent(),/Sua sessão é inválida ou expirou/);
      assert.equal(t.calls.filter(c=>c.path.startsWith('/rest/v1/')).length,0);
      await t.page.locator('#stateError [data-signout]').click();await state(t.page,'Login');await close(t);
    });
    await test('OTP rate limit is friendly and unlocks send button',async()=>{
      const t=await setup({handle:async(r,req,u)=>{if(u.pathname==='/auth/v1/otp'){await errorResponse(r,429);return true;}return false;}});
      await t.page.goto(base);await state(t.page,'Login');await t.page.locator('#email').fill(user.email);await t.page.locator('#sendButton').click();
      await t.page.waitForFunction(()=>document.querySelector('#formError').textContent.length>0);
      assert.match(await t.page.locator('#formError').textContent(),/Muitas tentativas/);
      assert.equal(await t.page.locator('#sendButton').isDisabled(),false);await close(t);
    });
    await test('logout error is friendly and supports another attempt',async()=>{
      let fail=true;
      const t=await setup({saved:session(),handle:async(r,req,u)=>{if(u.pathname==='/auth/v1/logout'&&fail){await errorResponse(r,500);return true;}return false;}});
      await t.page.goto(base);await state(t.page,'Granted');await t.page.locator('#stateGranted [data-signout]').click();await state(t.page,'Error');
      assert.match(await t.page.locator('#fatalError').textContent(),/encerrar sua sessão/);
      fail=false;await t.page.locator('#stateError [data-signout]').click();await state(t.page,'Login');await close(t);
    });
    await test('SDK download failure leaves loading and presents friendly error',async()=>{
      const t=await setup({sdkFail:true});await t.page.goto(base);await state(t.page,'Error');
      assert.match(await t.page.locator('#fatalError').textContent(),/carregar o serviço/);
      await t.ctx.unroute(sdkURL);await t.page.locator('#retryButton').click();await state(t.page,'Login');await close(t);
    });
    await test('stalled SDK load times out',async()=>{
      const t=await setup();await t.page.clock.install();await t.ctx.route(sdkURL,()=>{});
      await t.page.goto(base);await state(t.page,'Loading');await t.page.clock.fastForward(20001);await state(t.page,'Error');
      assert.match(await t.page.locator('#fatalError').textContent(),/carregar o serviço/);await close(t);
    });
    await test('stalled RPC times out and never grants access',async()=>{
      const t=await setup({saved:session(),handle:async(r,req,u)=>u.pathname==='/rest/v1/rpc/mp_has_active_access'});
      await t.page.clock.install();await t.page.goto(base);
      while(!t.calls.some(c=>c.path==='/rest/v1/rpc/mp_has_active_access'))await t.page.waitForTimeout(10);
      await t.page.clock.fastForward(20001);await state(t.page,'Error');
      assert.match(await t.page.locator('#fatalError').textContent(),/verificar se sua compra/);await close(t);
    });
    console.log(`${passed.length} tests passed; real Supabase JS SDK, synthetic sessions, mocked API only.`);
  } finally {await browser.close();server.close();server.closeAllConnections();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
