import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modules = process.env.GATHER_TEST_MODULES || '/tmp/gather-validation/node_modules';
const { PGlite } = await import(pathToFileURL(`${modules}/@electric-sql/pglite/dist/index.js`).href);
const db = new PGlite();
const alice = '10000000-0000-0000-0000-000000000001';
const bob = '20000000-0000-0000-0000-000000000002';
const stranger = '30000000-0000-0000-0000-000000000003';
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to authenticated;
  create table profiles(id uuid primary key);
  create table friendships(user_low uuid,user_high uuid, primary key(user_low,user_high));
  create table notification_preferences(user_id uuid primary key, reminders_enabled boolean default true, reminder_15_enabled boolean default true, reminder_start_enabled boolean default true, friend_request_notifications boolean default true);
  create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,event_id uuid,friend_request_id uuid,kind text,read_at timestamptz);
  grant select on profiles, friendships to authenticated;
  grant select, insert, update on notification_preferences to authenticated;
  alter table notification_preferences enable row level security;
  create policy own_preferences on notification_preferences for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
  insert into profiles values('${alice}'),('${bob}'),('${stranger}');
  insert into friendships values('${alice}','${bob}');
  insert into notification_preferences(user_id) values('${alice}'),('${bob}'),('${stranger}');
`);
const migration = await readFile(new URL('../supabase/messaging-upgrade.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration);
console.log('PASS migration is rerunnable');

async function asUser(id, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec('reset role'); }
}
const first = await asUser(alice, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3) returning id', [alice, bob, 'Hello Bob']);
const messageId = first.rows[0].id;
assert.equal((await asUser(bob, 'select body from messages')).rows[0].body, 'Hello Bob');
assert.equal((await asUser(stranger, 'select * from messages')).rows.length, 0);
console.log('PASS friends can send persistent messages; strangers cannot read them');
await assert.rejects(() => asUser(stranger, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3)', [stranger, bob, 'Blocked']));
await assert.rejects(() => asUser(alice, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3)', [bob, alice, 'Spoofed']));
await assert.rejects(() => asUser(alice, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3)', [alice, alice, 'Self']));
await assert.rejects(() => asUser(alice, 'update messages set body = $1 where id = $2', ['Tampered', messageId]));
assert.equal((await asUser(alice, 'update messages set read_at = now() where id = $1 returning id', [messageId])).rows.length, 0);
console.log('PASS non-friend/self/spoofed sends and message edits are rejected');
assert.equal(Number((await asUser(bob, 'select * from text_inbox()')).rows[0].unread_count), 1);
await asUser(bob, 'update messages set read_at = now() where id = $1', [messageId]);
assert.equal(Number((await asUser(bob, 'select * from text_inbox()')).rows[0].unread_count), 0);
assert.equal((await asUser(stranger, 'select * from text_inbox()')).rows.length, 0);
console.log('PASS recipient read receipts and private inbox counts');
assert.equal(Number((await db.query('select count(*) from notifications where user_id=$1', [bob])).rows[0].count), 1);
await asUser(bob, 'update notification_preferences set notifications_enabled = false where user_id=$1', [bob]);
assert.equal((await asUser(bob, 'select notifications_enabled from notification_preferences where user_id=$1', [bob])).rows[0].notifications_enabled, false);
await asUser(alice, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3)', [alice, bob, 'Muted but saved']);
await db.query("insert into notifications(user_id,event_id,kind) values($1,gen_random_uuid(),'reminder_start')", [bob]);
await db.query("insert into notifications(user_id,friend_request_id,kind) values($1,gen_random_uuid(),'friend_request')", [bob]);
assert.equal(Number((await db.query('select count(*) from notifications where user_id=$1', [bob])).rows[0].count), 1);
assert.equal((await asUser(bob, 'select * from messages')).rows.length, 2);
await asUser(bob, 'update notification_preferences set notifications_enabled = true where user_id=$1', [bob]);
await asUser(alice, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3)', [alice, bob, 'Notifications restored']);
assert.equal(Number((await db.query('select count(*) from notifications where user_id=$1', [bob])).rows[0].count), 2);
console.log('PASS notification master toggle persists and suppresses message/friend/reminder alerts, not messages');
await db.exec(`delete from friendships where user_low='${alice}' and user_high='${bob}';`);
await assert.rejects(() => asUser(alice, 'insert into messages(sender_id,recipient_id,body) values($1,$2,$3)', [alice, bob, 'No longer friends']));
assert.equal((await asUser(bob, 'select * from messages')).rows.length, 3);
console.log('PASS removing friendship blocks new sends without exposing or erasing history');
await db.close();