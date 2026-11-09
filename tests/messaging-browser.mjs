import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modules = process.env.GATHER_TEST_MODULES || '/tmp/gather-validation/node_modules';
const { chromium, webkit } = await import(pathToFileURL(`${modules}/playwright/index.mjs`).href);
const base = process.env.GATHER_TEST_URL || 'http://127.0.0.1:8000';
const sdk = `
const own='10000000-0000-0000-0000-000000000001', peer='20000000-0000-0000-0000-000000000002';
const profiles=[{id:own,username:'Alice',created_at:'2026-01-01'},{id:peer,username:'Bob',created_at:'2026-01-01'}];
const saved=()=>JSON.parse(sessionStorage.getItem('gather-test')||'null')||{messages:[],prefs:{user_id:own,notifications_enabled:true,reminders_enabled:true},notifications:[]};
const save=data=>sessionStorage.setItem('gather-test',JSON.stringify(data));
window.testHandlers=[];
function from(table){
 let action='select',values,filters=[],returnOne=false,head=false;
 const builder={select(_cols,options){head=options?.head;return builder},eq(key,value){filters.push(row=>row[key]===value);return builder},in(key,list){filters.push(row=>list.includes(row[key]));return builder},is(key,value){filters.push(row=>(row[key]??null)===value);return builder},or(){return builder},order(){return builder},limit(){return builder},insert(data){action='insert';values=data;return builder},upsert(data){action='upsert';values=data;return builder},update(data){action='update';values=data;return builder},delete(){action='delete';return builder},single(){returnOne=true;return builder},maybeSingle(){returnOne=true;return builder},then(resolve,reject){try{let store=saved();let rows=table==='profiles'?profiles:table==='friendships'?(store.removed?[]:[{user_low:own,user_high:peer}]):table==='notification_preferences'?[store.prefs]:table==='messages'?store.messages:table==='notifications'?store.notifications:[];
 rows=rows.filter(row=>filters.every(filter=>filter(row)));
 if(action==='upsert'&&table==='notification_preferences'){Object.assign(store.prefs,values);rows=[store.prefs];save(store)}
 if(action==='update'){rows.forEach(row=>Object.assign(row,values));save(store)}
 if(action==='insert'&&table==='messages'){if(window.testFailSend){resolve({data:null,error:{message:'Test send failed'}});return}const row={...values,id:crypto.randomUUID(),created_at:new Date().toISOString(),read_at:null};store.messages.push(row);save(store);rows=[row]}
 if(action==='insert'&&table==='profiles'){window.testProfileWrites=(window.testProfileWrites||0)+1;if(window.testProfileFkError){resolve({data:null,error:{code:'23503',message:'insert on profiles violates foreign key constraint profiles_id_fkey'}});return}const row={...values,created_at:new Date().toISOString()};profiles.push(row);rows=[row]}
 if(table==='notifications')rows=rows.map(row=>({...row,messages:row.message_id?{sender_id:peer,body:'Incoming hello',sender:{username:'Bob'}}:null}));
 resolve({data:head?null:returnOne?(rows[0]||null):rows,error:null,count:rows.length});}catch(error){reject(error)}}};return builder;
}
export function createClient(){return {from,rpc:async(name)=>{const store=saved();if(name==='remove_friend'){store.removed=true;save(store);return {data:null,error:null}}const last=store.messages.at(-1);return {data:last?[{friend_id:peer,message_id:last.id,body:last.body,created_at:last.created_at,unread_count:store.messages.filter(row=>row.recipient_id===own&&!row.read_at).length}]:[],error:null}},auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:own}}}})},channel(){return {on(_kind,filter,callback){window.testHandlers.push({filter,callback});return this},subscribe(){return this},unsubscribe:async()=>{}}},functions:{invoke:async()=>({data:{sent:0},error:null})},storage:{from(){return {download:async()=>({error:{message:'No test image'}})}}}}}
window.testIncoming=async()=>{const store=saved();const message={id:crypto.randomUUID(),sender_id:peer,recipient_id:own,body:'Incoming hello',created_at:new Date().toISOString(),read_at:null};store.messages.push(message);save(store);for(const h of window.testHandlers.filter(h=>h.filter.table==='messages'))await h.callback({new:message});};
window.testNotification=async()=>{const store=saved();store.notifications.push({id:crypto.randomUUID(),user_id:own,message_id:store.messages.at(-1).id,kind:'message',created_at:new Date().toISOString(),read_at:null});save(store)};
window.testRemoveFriend=async()=>{const store=saved();store.removed=true;save(store);for(const h of window.testHandlers.filter(h=>h.filter.table==='friendships'))await h.callback({eventType:'DELETE'});};
`;
const engine = process.env.GATHER_TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('https://esm.sh/@supabase/supabase-js@2', (route) => route.fulfill({ contentType: 'application/javascript', body: sdk }));
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/events-manager.html`);
  await page.locator('[data-tab="friends"]').click();
  await page.locator('[data-text-friend]').click();
  await page.getByPlaceholder('Message your friend...').fill('A real UI test message');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.chat-bubble', { hasText: 'A real UI test message' }).waitFor();
  await page.evaluate(() => { window.testFailSend = true; });
  await page.getByPlaceholder('Message your friend...').fill('Keep this draft');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.chat-send-error', { hasText: 'Test send failed' }).waitFor();
  assert.equal(await page.getByPlaceholder('Message your friend...').inputValue(), 'Keep this draft');
  await page.evaluate(() => { window.testFailSend = false; });
  const composer = page.getByPlaceholder('Message your friend...');
  await composer.fill('Sent with Enter');
  await composer.press('Enter');
  await page.locator('.chat-bubble', { hasText: 'Sent with Enter' }).waitFor();
  await composer.fill('First line');
  await composer.press('Shift+Enter');
  await composer.press('End');
  await composer.type('Second line');
  assert.equal(await composer.inputValue(), 'First line\nSecond line');
  const messageCount = await page.locator('.chat-bubble').count();
  await composer.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  assert.equal(await page.locator('.chat-bubble').count(), messageCount);
  await composer.fill('   ');
  await composer.press('Enter');
  assert.equal(await page.locator('.chat-bubble').count(), messageCount);
  await composer.fill('');
  console.log('PASS Enter sends; Shift+Enter adds a line; composition and empty drafts do not send');
  console.log('PASS friend Text button opens chat and Send saves/displays history');
  await page.reload();
  await page.locator('[data-tab="text"]').click();
  await page.locator('[data-chat-peer]').click();
  await page.locator('.chat-bubble', { hasText: 'A real UI test message' }).waitFor();
  await page.locator('[data-tab="calendar"]').click();
  await page.evaluate(() => window.testIncoming());
  assert.equal(await page.locator('[data-text-unread]').textContent(), '1');
  await page.evaluate(() => window.testNotification());
  await page.locator('[data-action="notifications"]').click();
  await page.locator('[data-notification-id]').click();
  await page.locator('.chat-bubble', { hasText: 'Incoming hello' }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-text-unread]').hidden);
  console.log('PASS history survives reload, incoming messages update unread badge, notification opens correct chat');
  await page.locator('[data-tab="settings"]').click();
  await page.locator('[data-pref="notifications_enabled"]').uncheck();
  await page.getByText('Notifications Disabled', { exact: true }).waitFor();
  await page.reload();
  await page.locator('[data-tab="settings"]').click();
  assert.equal(await page.locator('[data-pref="notifications_enabled"]').isChecked(), false);
  await page.locator('[data-pref="notifications_enabled"]').check();
  await page.getByText('Notifications Enabled', { exact: true }).waitFor();
  console.log('PASS notification master toggle can turn off/on and survives reload');
  for (const [width, height] of [[1280, 900], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.locator('[data-tab="text"]').click();
    if (await page.locator('[data-chat-back]').isVisible()) await page.locator('[data-chat-back]').click();
    await page.locator('[data-chat-peer]').click();
    await page.locator('.chat-bubble').first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
    await page.screenshot({ path: `/tmp/gather-text-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS desktop/tablet/mobile Text layout, no page errors; screenshots saved under /tmp/gather-text-*.png');
  await page.locator('[data-tab="friends"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-remove-friend]').click();
  await page.getByRole('heading', { name: 'Your circle starts here' }).waitFor();
  await page.locator('[data-tab="text"]').click();
  await page.getByRole('heading', { name: 'No conversations yet' }).waitFor();
  assert.equal(await page.locator('[data-chat-peer]').count(), 0);
  assert.equal(await page.locator('[data-text-unread]').isVisible(), false);
  await page.reload();
  await page.locator('[data-tab="text"]').click();
  await page.getByRole('heading', { name: 'No conversations yet' }).waitFor();
  await page.evaluate(() => { const data = JSON.parse(sessionStorage.getItem('gather-test')); data.removed = false; sessionStorage.setItem('gather-test', JSON.stringify(data)); });
  await page.reload();
  await page.locator('[data-tab="friends"]').click();
  await page.locator('[data-text-friend]').click();
  await page.locator('.chat-composer').waitFor();
  await page.evaluate(() => window.testRemoveFriend());
  await page.getByRole('heading', { name: 'No conversations yet' }).waitFor();
  assert.equal(await page.locator('.chat-composer').count(), 0);
  assert.ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('gather-test')).messages.length > 0));
  console.log('PASS removed friends disappear from Text and unread counts after reload; realtime removal closes active chat without deleting messages');
  const friendlessSdk = sdk
    .replace("table==='friendships'?(store.removed?[]:[{user_low:own,user_high:peer}])", "table==='friendships'?[]")
    .replace('or(){return builder}', "neq(key,value){filters.push(row=>row[key]!==value);return builder},ilike(key,value){filters.push(row=>row[key].toLowerCase().includes(value.replaceAll('%','').toLowerCase()));return builder},or(){return builder}");
  await page.route('https://esm.sh/@supabase/supabase-js@2', (route) => route.fulfill({ contentType: 'application/javascript', body: friendlessSdk }));
  for (const [width, height] of [[1366, 1024], [1280, 900], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/events-manager.html`);
    await page.locator('[data-tab="friends"]').click();
    await page.getByRole('heading', { name: 'Your circle starts here' }).waitFor();
    await page.locator('.empty-state [data-action="search"]').click();
    await page.locator('#search-form input').fill('Bob');
    await page.locator('#search-form button[type="submit"]').click();
    await page.locator('.search-result', { hasText: '@Bob' }).waitFor();
    assert.equal(await page.locator('#search-form input').inputValue(), 'Bob');
    await page.locator('#modal [data-close]').click();
    await page.locator('.page-heading [data-action="search"]').click();
    await page.locator('#search-form').waitFor();
    await page.locator('#modal [data-close]').click();
    await page.locator('[data-tab="calendar"]').click();
    const allDay = page.locator('#event-form [name="all_day"]');
    assert.equal(await page.locator('#event-form .time-fields').isVisible(), false);
    await allDay.uncheck();
    await page.locator('#event-form [name="event_date"]').fill('2026-11-10');
    await page.locator('#event-form [name="start_time"]').fill('18:00');
    await page.locator('#event-form [name="end_time"]').fill('19:00');
    const geometry = await page.locator('#event-form').evaluate((form) => {
      const bounds = form.getBoundingClientRect();
      const fields = [...form.querySelectorAll('input[type="date"], input[type="time"], .switch-row')];
      const rects = fields.map((field) => field.getBoundingClientRect());
      const start = form.querySelector('[name="start_time"]').getBoundingClientRect();
      const end = form.querySelector('[name="end_time"]').getBoundingClientRect();
      return {
        inside: rects.every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
        paired: Math.abs(start.top - end.top) < 1 && start.right <= end.left,
        switchHeight: form.querySelector('.switch-row').getBoundingClientRect().height
      };
    });
    assert.ok(geometry.inside, `Planner fields contained at ${width}px`);
    assert.ok(geometry.paired, `From and To aligned at ${width}px`);
    assert.ok(geometry.switchHeight <= 48, `Compact All day control at ${width}px`);
    await allDay.check();
    assert.equal(await page.locator('#event-form .time-fields').isVisible(), false);
    await allDay.uncheck();
    await page.locator('.planner-panel').screenshot({ path: `/tmp/gather-planner-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS empty-state/header friend search and date/All day/From-To controls at desktop, tablet portrait/landscape, and phone widths');
  const setupSdk = sdk
    .replace("{id:own,username:'Alice',created_at:'2026-01-01'},", '')
    .replace('auth:{onAuthStateChange(){}', "auth:{signOut:async()=>({error:null}),getUser:async()=>window.testAuthNetworkError?{data:{user:null},error:{status:0,message:'Network unavailable'}}:window.testStaleAccount?{data:{user:null},error:{status:403,message:'User no longer exists'}}:{data:{user:{id:own}},error:null},onAuthStateChange(){}");
  await page.route('https://esm.sh/@supabase/supabase-js@2', (route) => route.fulfill({ contentType: 'application/javascript', body: setupSdk }));
  await page.goto(`${base}/events-manager.html`);
  await page.getByRole('heading', { name: 'Create your profile' }).waitFor();
  await page.getByRole('button', { name: 'back to Login', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Create an account', exact: true }).waitFor();
  for (const [width, height] of [[768, 1024], [820, 1180], [1024, 768], [820, 600]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/events-manager.html`);
    const back = page.getByRole('button', { name: 'back to Login', exact: true });
    await back.waitFor();
    const bounds = await back.boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height, `Back to Login visible without scrolling at ${width}x${height}`);
    await back.click();
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('PASS incomplete profile setup can return to Login without submitting the form');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${base}/events-manager.html`);
  await page.locator('#profile-form [name="username"]').fill('AliceNew');
  await page.evaluate(() => { window.testAuthNetworkError = true; });
  await page.locator('#profile-form button[type="submit"]').click();
  await page.locator('#toast', { hasText: 'Network unavailable' }).waitFor();
  assert.equal(await page.locator('#profile-form [name="username"]').inputValue(), 'AliceNew');
  assert.equal(await page.evaluate(() => window.testProfileWrites || 0), 0);
  await page.evaluate(() => { window.testAuthNetworkError = false; window.testStaleAccount = true; });
  await page.locator('#profile-form button[type="submit"]').click();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.testProfileWrites || 0), 0);
  await page.goto(`${base}/events-manager.html`);
  await page.locator('#profile-form [name="username"]').fill('AliceNew');
  await page.evaluate(() => { window.testProfileFkError = true; });
  await page.locator('#profile-form button[type="submit"]').click();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  await page.goto(`${base}/events-manager.html`);
  await page.locator('#profile-form [name="username"]').fill('AliceNew');
  await page.locator('#profile-form button[type="submit"]').click();
  await page.locator('[data-tab="calendar"]').waitFor();
  assert.equal(await page.evaluate(() => window.testProfileWrites), 1);
  assert.deepEqual(errors, []);
  console.log('PASS iPad profile creation validates Auth, preserves drafts on network errors, recovers deleted sessions, and saves valid accounts');
} finally { await browser.close(); }