"use strict";
const express=require("express");
const cors=require("cors");
const crypto=require("crypto");
const multer=require("multer");
const {onRequest}=require("firebase-functions/v2/https");
const {initializeApp,getApps}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {GoogleGenAI}=require("@google/genai");
const {v2:cloudinary}=require("cloudinary");

if(!getApps().length) initializeApp();
const db=getFirestore();
const auth=getAuth();
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:50*1024*1024}});
const GEMINI_KEY=process.env.GEMINI_API_KEY||"";
const TEXT_MODEL=process.env.GEMINI_TEXT_MODEL||"gemini-3.5-flash-lite";
const IMAGE_MODEL=process.env.GEMINI_IMAGE_MODEL||"gemini-3.1-flash-image";
const WEB_API_KEY=process.env.FIREBASE_WEB_API_KEY||"";
const ai=GEMINI_KEY?new GoogleGenAI({apiKey:GEMINI_KEY}):null;
if(process.env.CLOUDINARY_URL) cloudinary.config({cloudinary_url:process.env.CLOUDINARY_URL,secure:true});
else cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});

app.disable("x-powered-by");
app.use(cors({origin:true,methods:["GET","POST","OPTIONS"],allowedHeaders:["Content-Type","Authorization","X-User-ID","X-Conversation-ID"]}));
app.use(express.json({limit:"8mb"}));

const base="Tu es Wiener IA, assistant généraliste intelligent, précis, pédagogique et naturel. Réponds en français par défaut. Sois direct, structuré et honnête. N'invente jamais de faits, de sources ou d'actions réalisées. Ne révèle jamais les clés ou secrets.";
const exercise="Résous l'exercice avec rigueur. Donne la méthode, les calculs essentiels et la réponse finale clairement.";
const searchPrompt="Tu es le module Recherche Web de Wiener IA. Utilise Google Search pour obtenir des informations actuelles et vérifiables. Distingue les faits trouvés des déductions et cite les sources utilisées.";

function status(e){return Number(e?.status)||Number(e?.statusCode)||Number(e?.response?.status)||500}
function textOf(r){if(typeof r?.text==="string"&&r.text.trim())return r.text.trim();return (r?.candidates||[]).flatMap(c=>c?.content?.parts||[]).filter(p=>typeof p.text==="string").map(p=>p.text).join("\n").trim()}
async function user(req){const h=req.get("authorization")||"";if(!h.startsWith("Bearer "))return null;try{return await auth.verifyIdToken(h.slice(7))}catch{return null}}
async function ctx(req){const u=await user(req);return{uid:u?.uid||String(req.get("x-user-id")||"").trim(),email:u?.email||null,cid:String(req.get("x-conversation-id")||"").trim()}}
async function saveMessage(uid,cid,role,content,mode="chat",attachments=[]){if(!uid||!cid||!content)return;await db.collection("conversations").doc(cid).set({id:cid,userId:uid,updatedAt:FieldValue.serverTimestamp(),title:String(content).slice(0,80),mode},{merge:true});const r=db.collection("conversations").doc(cid).collection("messages").doc();await r.set({id:r.id,userId:uid,conversationId:cid,role,content:String(content).slice(0,20000),mode,attachments,createdAt:FieldValue.serverTimestamp()})}
async function firebaseAuth(action,email,password){if(!WEB_API_KEY)throw Object.assign(Error("FIREBASE_WEB_API_KEY est manquante."),{status:503});const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(WEB_API_KEY)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,returnSecureToken:true})});const d=await r.json();if(!r.ok)throw Object.assign(Error(d?.error?.message||"Authentification impossible."),{status:r.status});return d}
function error(res,e){const s=status(e);res.status(s>=500?500:s).json({error:s===429?"Service temporairement limité.":e?.message||"Erreur serveur."})}

app.get("/api/health",(_,res)=>res.json({ok:true,service:"Wiener IA",serverless:true,geminiConfigured:Boolean(ai),firebaseConfigured:true,cloudinaryConfigured:Boolean(cloudinary.config().cloud_name),authConfigured:Boolean(WEB_API_KEY),textModel:TEXT_MODEL,time:new Date().toISOString()}));
app.get("/health",(_,res)=>res.json({ok:true,serverless:true,service:"Wiener IA",geminiConfigured:Boolean(ai),firebaseConfigured:true,cloudinaryConfigured:Boolean(cloudinary.config().cloud_name),authConfigured:Boolean(WEB_API_KEY),textModel:TEXT_MODEL,time:new Date().toISOString()}));
app.get("/api/session",async(req,res)=>{const c=await ctx(req);res.json({ok:true,userId:c.uid||crypto.randomUUID(),firebaseConfigured:true,cloudinaryConfigured:Boolean(cloudinary.config().cloud_name)})});

app.post("/api/auth/signup",async(req,res)=>{try{const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!email||password.length<6)return res.status(400).json({error:"Email et mot de passe (6 caractères minimum) requis."});const d=await firebaseAuth("signUp",email,password);await db.collection("users").doc(d.localId).set({id:d.localId,email:d.email,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});res.json({ok:true,email:d.email,userId:d.localId,idToken:d.idToken,refreshToken:d.refreshToken,expiresIn:d.expiresIn})}catch(e){error(res,e)}});
app.post("/api/auth/login",async(req,res)=>{try{const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!email||!password)return res.status(400).json({error:"Email et mot de passe requis."});const d=await firebaseAuth("signInWithPassword",email,password);await db.collection("users").doc(d.localId).set({id:d.localId,email:d.email,updatedAt:FieldValue.serverTimestamp(),lastSeenAt:FieldValue.serverTimestamp()},{merge:true});res.json({ok:true,email:d.email,userId:d.localId,idToken:d.idToken,refreshToken:d.refreshToken,expiresIn:d.expiresIn})}catch(e){error(res,e)}});
app.get("/api/auth/me",async(req,res)=>{const u=await user(req);if(!u)return res.status(401).json({authenticated:false});res.json({authenticated:true,userId:u.uid,email:u.email||null})});

app.get("/api/conversations",async(req,res)=>{try{const c=await ctx(req);if(!c.uid)return res.status(401).json({error:"Authentification requise."});const s=await db.collection("conversations").where("userId","==",c.uid).orderBy("updatedAt","desc").limit(50).get();res.json({conversations:s.docs.map(d=>({id:d.id,...d.data()}))})}catch(e){error(res,e)}});
app.get("/api/conversations/:id/messages",async(req,res)=>{try{const c=await ctx(req),id=req.params.id;if(!c.uid)return res.status(401).json({error:"Authentification requise."});const conv=await db.collection("conversations").doc(id).get();if(!conv.exists||conv.data().userId!==c.uid)return res.status(404).json({error:"Conversation introuvable."});const s=await db.collection("conversations").doc(id).collection("messages").orderBy("createdAt","asc").limit(500).get();res.json({messages:s.docs.map(d=>({id:d.id,...d.data()}))})}catch(e){error(res,e)}});

app.post("/api/chat",async(req,res)=>{try{if(!ai)return res.status(503).json({error:"GEMINI_API_KEY est manquante."});const messages=Array.isArray(req.body?.messages)?req.body.messages.filter(x=>x&&typeof x.content==="string").slice(-8):[{role:"user",content:String(req.body?.message||"")}];if(!messages.length||!messages[messages.length-1].content.trim())return res.status(400).json({error:"Aucun message valide."});const c=await ctx(req),last=messages[messages.length-1];if(c.uid&&c.cid)await saveMessage(c.uid,c.cid,"user",last.content);res.setHeader("Content-Type","text/event-stream; charset=utf-8");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive");const stream=await ai.models.generateContentStream({model:TEXT_MODEL,contents:messages.map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:String(m.content).slice(0,8000)}]})),config:{systemInstruction:base,thinkingConfig:{thinkingLevel:"minimal"},maxOutputTokens:768}});let full="";for await(const ch of stream){const t=typeof ch?.text==="string"?ch.text:(ch?.candidates||[]).flatMap(x=>x?.content?.parts||[]).map(x=>x.text||"").join("");if(t){full+=t;res.write(`data: ${JSON.stringify({text:t})}\n\n`)}}res.write(`event: done\ndata: ${JSON.stringify({answer:full.trim(),model:TEXT_MODEL})}\n\n`);res.end();if(c.uid&&c.cid)await saveMessage(c.uid,c.cid,"assistant",full)}catch(e){if(res.headersSent){res.write(`event: error\ndata: ${JSON.stringify({error:e?.message||"Réponse interrompue."})}\n\n`);res.end()}else error(res,e)}});

app.post("/api/exercises",async(req,res)=>{try{if(!ai)return res.status(503).json({error:"GEMINI_API_KEY est manquante."});const q=String(req.body?.question||req.body?.message||"").trim();if(!q)return res.status(400).json({error:"Aucun exercice."});const r=await ai.models.generateContent({model:TEXT_MODEL,contents:q,config:{systemInstruction:exercise,thinkingConfig:{thinkingLevel:"minimal"},maxOutputTokens:1536}});const answer=textOf(r);const c=await ctx(req);if(c.uid&&c.cid){await saveMessage(c.uid,c.cid,"user",q,"exercise");await saveMessage(c.uid,c.cid,"assistant",answer,"exercise")}res.json({answer,model:TEXT_MODEL})}catch(e){error(res,e)}});
app.post("/api/search",async(req,res)=>{try{if(!ai)return res.status(503).json({error:"GEMINI_API_KEY est manquante."});const q=String(req.body?.query||"").trim();if(!q)return res.status(400).json({error:"Recherche vide."});const r=await ai.models.generateContent({model:TEXT_MODEL,contents:q,config:{systemInstruction:searchPrompt,tools:[{googleSearch:{}}],thinkingConfig:{thinkingLevel:"minimal"},maxOutputTokens:1536}});res.json({answer:textOf(r),response:textOf(r),model:TEXT_MODEL,search:true,groundingMetadata:r?.candidates?.[0]?.groundingMetadata||null})}catch(e){error(res,e)}});
app.post("/api/calculate",(req,res)=>{const x=String(req.body?.expression||"").trim();if(!x||x.length>500||!/^[0-9+\-*/().,%\s^]+$/.test(x))return res.status(400).json({error:"Expression mathématique invalide."});try{const v=Function(`"use strict";return (${x.replace(/\^/g,"**")})`)();if(!Number.isFinite(v))throw Error();res.json({result:String(v)})}catch{res.status(400).json({error:"Expression mathématique invalide."})}});

app.post("/api/upload",upload.single("file"),async(req,res)=>{try{const c=await ctx(req);if(!c.uid)return res.status(401).json({error:"Connectez-vous pour envoyer un média."});if(!req.file)return res.status(400).json({error:"Fichier manquant."});const mime=req.file.mimetype||"";if(!mime.startsWith("image/")&&!mime.startsWith("video/"))return res.status(400).json({error:"Seules les images et vidéos sont acceptées."});const resourceType=mime.startsWith("video/")?"video":"image";const r=await new Promise((resolve,reject)=>{const s=cloudinary.uploader.upload_stream({folder:"wiener-ia/uploads",resource_type:resourceType,use_filename:true,unique_filename:true},(e,v)=>e?reject(e):resolve(v));s.end(req.file.buffer)});const media={url:r.secure_url,public_id:r.public_id,resource_type:r.resource_type,mimeType:mime,originalName:req.file.originalname,bytes:r.bytes,width:r.width||null,height:r.height||null,duration:r.duration||null};const ref=db.collection("media").doc();await ref.set({id:ref.id,userId:c.uid,conversationId:c.cid||null,...media,createdAt:FieldValue.serverTimestamp()});res.json({ok:true,media:{id:ref.id,...media}})}catch(e){error(res,e)}});

app.post("/api/image",async(req,res)=>{try{if(!ai)return res.status(503).json({error:"GEMINI_API_KEY est manquante."});const prompt=String(req.body?.prompt||"").trim();if(!prompt)return res.status(400).json({error:"Prompt manquant."});const r=await ai.interactions.create({model:IMAGE_MODEL,input:prompt});const img=r?.output_image;if(!img?.data)return res.status(502).json({error:"Aucune image retournée."});const mime=img.mime_type||"image/png";const result=await new Promise((resolve,reject)=>{const s=cloudinary.uploader.upload_stream({folder:"wiener-ia/generated",resource_type:"image",format:mime.split("/")[1]||"png"},(e,v)=>e?reject(e):resolve(v));s.end(Buffer.from(img.data,"base64"))});const c=await ctx(req);res.json({ok:true,url:result.secure_url,model:IMAGE_MODEL,prompt})}catch(e){error(res,e)}});

exports.api=onRequest({region:"us-central1",timeoutSeconds:120,memory:"1GiB",maxInstances:10},app);
