// cloud-sessions.js — authentication + cloud storage for INTZ sessions
// Requires: supabase-client.js
import { supabase } from './supabase-client.js';

const BUCKET = 'intz-workouts';

export async function signInEmail(email, password){
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if(error) throw error;
  return data.user;
}

export async function signUpEmail(email, password){
  const { data, error } = await supabase.auth.signUp({ email, password });
  if(error) throw error;
  return data.user;
}

export async function signOut(){
  await supabase.auth.signOut();
}

export async function getCurrentUser(){
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function filenameFor(now=new Date()){
  const ts = now.toISOString().replace(/[:.]/g,'-');
  return `session_${ts}.json`;
}

function withUserPrefix(user_id, name){
  return `${user_id}/${name}`;
}

export async function uploadSessionJSON(sessionObj, name=filenameFor()){
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData?.user?.id;
  if(!user_id) throw new Error('Ikke innlogget');
  const path = withUserPrefix(user_id, name);
  const blob = new Blob([JSON.stringify(sessionObj)], { type: 'application/json' });
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert:false, contentType:'application/json' });
  if(error) throw error;
  // prøv å legge inn metadata i DB (valgfritt)
  try { await supabase.from('sessions').insert({ user_id, filename: path }); } catch(_) {}
  return data;
}

export async function listSessionsMeta(){
  // Foretrekker DB-tabell hvis den finnes; ellers hent fra storage med user-prefix
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData?.user?.id;
  if(!user_id) throw new Error('Ikke innlogget');
  try{
    const { data, error } = await supabase.from('sessions').select('*').eq('user_id', user_id).order('created_at', { ascending:false });
    if(error) throw error;
    return data.map(r=>({ id:r.id, filename:r.filename, created_at:r.created_at }));
  }catch(e){
    // Fallback: list objects in bucket under user_id prefix
    const { data, error } = await supabase.storage.from(BUCKET).list(user_id, { limit:1000, sortBy:{ column:'created_at', order:'desc' }});
    if(error) throw error;
    return (data||[]).map(o=>({ id:o.id||o.name, filename: withUserPrefix(user_id, o.name), created_at:o.created_at||null }));
  }
}

export async function downloadSession(filename){
  const { data, error } = await supabase.storage.from(BUCKET).download(filename);
  if(error) throw error;
  const txt = await data.text();
  return JSON.parse(txt);
}
