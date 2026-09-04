"use strict";
const express=require("express");
const cors=require("cors");
const path=require("path");
const {GoogleGenAI}=require("@google/genai");
const multer=require("multer");
const {CausalEngine}=require("./causal_engine");

const app=express();
const PORT=Number(process.env.PORT)||10000;
const API_KEY=process.env.GEMINI_API_KEY;
const TEXT_MODEL=process.env.GEMINI_TEXT_MODEL||"gemini-3.5-flash-lite";
const FALLBACK_MODELS=[TEXT_MODEL,"gemini-3.6-flash","gemini-3.7-flash","gemini-2.5-flash"].filter((v,i,a)=>v&&a.indexOf(v)===i);
const IMAGE_MODELS=[process.env.GEMINI_IMAGE_MODEL||"gemini-3.1-flash-image","gemini-2.5-flash-image"];
const MAX_MESSAGES=30,MAX_MESSAGE_LENGTH=20000,MAX_FILE_SIZE=20*1024*1024;
const ai=API_KEY?new GoogleGenAI({apiKey:API_KEY}):null;
const causal=new CausalEngine();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_FILE_SIZE}});

app.disable("x-powered-by");
app.use(cors({origin:true,methods:["GET","POST","DELETE","OPTIONS"],allowedHeaders:["Content-Type"]}));
app.use(express.json({limit:"10mb"}));
app.use(express.static(__dirname));

const BASE_INSTRUCTIONS=`Tu es Wiener IA, un assistant généraliste intelligent, précis, pédagogique et naturel. Réponds en français par défaut. Comprends la demande avant de répondre. Sois concis pour une demande simple et structuré pour une demande complexe. N'invente jamais de faits, de sources ou d'actions réalisées. N'expose jamais les secrets ou clés API. Adapte les explications au niveau de l'utilisateur.`;
const EXERCISE_INSTRUCTIONS=`Résous l'exercice avec rigueur. Identifie les données, la méthode utile, effectue les calculs étape par étape, vérifie le résultat et donne clairement la réponse finale. N'invente aucune donnée manquante.`;
const ANALYSIS_INSTRUCTIONS=`Analyse la demande de façon fonctionnelle: intention, complexité, incertitudes, informations nécessaires, stratégie et points à vérifier. Ne présente jamais cette analyse comme une conscience biologique ou une expérience subjective.`;
const SEARCH_INSTRUCTIONS=`Tu es le module Recherche Web de Wiener IA. Utilise Google Search pour obtenir des informations actuelles et vérifiables. Distingue les faits trouvés des déductions et ne fabrique jamais de source. Réponds en français par défaut et cite les sources utilisées.`;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function statusOf(e){return Number(e?.status)||Number(e?.statusCode)||Number(e?.response?.status)||500;}
function requireAI(res){if(!ai){res.status(503).json({error:"Le serveur IA n'est pas configuré: GEMINI_API_KEY est manquante."});return false;}return true;}
function cleanMessages(messages){if(!Array.isArray(messages))return[];return messages.filter(m=>m&&typeof m==="object"&&["user","assistant","model"].includes(m.role)&&typeof m.content==="string"&&m.content.trim()).map(m=>({role:m.role==="assistant"||m.role==="model"?"model":"user",content:m.content.trim().slice(0,MAX_MESSAGE_LENGTH)})).slice(-MAX_MESSAGES);}
function toGemini(messages){return messages.map(m=>({role:m.role,parts:[{text:m.content}]}));}
function textOf(response){if(typeof response?.text==="string"&&response.text.trim())return response.text.trim();const parts=response?.candidates?.flatMap(c=>Array.isArray(c?.content?.parts)?c.content.parts:[])||[];return parts.filter(p=>typeof p?.text==="string").map(p=>p.text).join("\n").trim();}
function groundingOf(response){const metadata=response?.candidates?.[0]?.groundingMetadata||response?.groundingMetadata||null;const chunks=Array.isArray(metadata?.groundingChunks)?metadata.groundingChunks:[];const sources=chunks.map((c,i)=>{const w=c?.web||c?.retrievedContext;return w?.uri?{index:i,title:w.title||new URL(w.uri).hostname,uri:w.uri}:null;}).filter(Boolean);return{metadata,sources,supports:Array.isArray(metadata?.groundingSupports)?metadata.groundingSupports:[]};}
async function generate(options){let last=null;for(const model of FALLBACK_MODELS){try{return{response:await ai.models.generateContent({...options,model}),model};}catch(e){last=e;if(![408,425,429,500,502,503,504].includes(statusOf(e)))throw e;await sleep(250);}}throw last||new Error("Aucun modèle Gemini disponible.");}
async function generateImage(prompt){let last=null;for(const model of [...new Set(IMAGE_MODELS)]){try{const interaction=await ai.interactions.create({model,input:prompt,response_format:{type:"image",mime_type:"image/jpeg",aspect_ratio:"1:1",image_size:"1K"}});const direct=interaction?.output_image?.data;if(direct)return{data:direct,model};const block=interaction?.steps?.flatMap(s=>s?.type==="model_output"?(s.content||[]):[]).find(c=>c?.type==="image"&&c?.data);if(block)return{data:block.data,model};throw new Error("Le modèle image n'a fourni aucune image.");}catch(e){last=e;if(![408,425,429,500,502,503,504].includes(statusOf(e)))throw e;await sleep(300);}}throw last||new Error("Aucun modèle image disponible.");}
function sendError(res,e){console.error("Wiener IA:",e?.stack||e);const s=statusOf(e);if(s===401||s===403)return res.status(s).json({error:"La clé Gemini est invalide ou non autorisée."});if(s===404)return res.status(404).json({error:"Le modèle Gemini demandé est indisponible."});if(s===429)return res.status(429).json({error:"Gemini est temporairement limité. Réessaie dans quelques instants."});if([502,503,504].includes(s))return res.status(s).json({error:"Le service Gemini est temporairement indisponible."});return res.status(500).json({error:e?.message||"Une erreur serveur est survenue."});}
function policy(state){return `\nPolitique interne: tâche=${state.D.task}, profondeur=${state.F.depth}, vérification=${state.F.verify?"oui":"non"}, recherche=${state.F.search?"oui":"non"}.`}

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/health",(_,res)=>res.json({ok:true,service:"Wiener IA",geminiConfigured:Boolean(ai),model:TEXT_MODEL}));
app.get("/api/health",(_,res)=>res.json({ok:true,service:"Wiener IA",geminiConfigured:Boolean(ai),textModel:TEXT_MODEL,availableModelCandidates:FALLBACK_MODELS,imageModels:IMAGE_MODELS,causalAudit:causal.audit(),time:new Date().toISOString()}));
app.get("/api/causal/state",(_,res)=>res.json(causal.snapshot()));
app.get("/api/causal/audit",(_,res)=>res.json(causal.audit()));

app.post("/api/chat",async(req,res)=>{try{if(!requireAI(res))return;let messages=cleanMessages(req.body?.messages);if(!messages.length&&Array.isArray(req.body?.history))messages=cleanMessages(req.body.history);if(!messages.length&&typeof req.body?.message==="string"&&req.body.message.trim())messages=[{role:"user",content:req.body.message.trim()}];if(!messages.length)return res.status(400).json({error:"Aucun message valide n'a été reçu."});const query=[...messages].reverse().find(m=>m.role==="user")?.content||"";const state=causal.step(query,"chat",messages);const result=await generate({contents:toGemini(messages),config:{systemInstruction:BASE_INSTRUCTIONS+policy(state),maxOutputTokens:2048}});const answer=textOf(result.response);if(!answer)return res.status(502).json({error:"Wiener IA n'a retourné aucune réponse."});res.json({answer,model:result.model,causal:{K:state.K,D:state.D,F:state.F,S:state.S}});}catch(e){sendError(res,e);}});

app.post("/api/exercises",async(req,res)=>{try{if(!requireAI(res))return;const question=typeof req.body?.question==="string"?req.body.question.trim():typeof req.body?.message==="string"?req.body.message.trim():"";if(!question)return res.status(400).json({error:"Aucun exercice n'a été reçu."});const level=typeof req.body?.level==="string"?req.body.level.trim():"non précisé",subject=typeof req.body?.subject==="string"?req.body.subject.trim():"non précisée",state=causal.step(question,"exercise",[]);const result=await generate({contents:[{role:"user",parts:[{text:`Niveau: ${level}\nMatière: ${subject}\n\nExercice:\n${question}`}]}],config:{systemInstruction:EXERCISE_INSTRUCTIONS+policy(state),maxOutputTokens:3072}});const answer=textOf(result.response);if(!answer)return res.status(502).json({error:"Aucune solution n'a été retournée."});res.json({answer,model:result.model,causal:{D:state.D,F:state.F}});}catch(e){sendError(res,e);}});

app.post("/api/calculate",(req,res)=>{const expression=typeof req.body?.expression==="string"?req.body.expression.trim():"";if(!expression)return res.status(400).json({error:"Expression vide."});if(expression.length>500||!/^[0-9+\-*/().,%\s^]+$/.test(expression))return res.status(400).json({error:"Expression non prise en charge."});try{const state=causal.step(expression,"calculator",[]);const normalized=expression.replace(/,/g,".").replace(/\^/g,"**").replace(/%/g,"/100");const result=Function(`"use strict";return (${normalized})`)();if(!Number.isFinite(result))throw new Error();res.json({result:String(result),causal:{D:state.D,F:state.F}});}catch{res.status(400).json({error:"Expression mathématique invalide."});}});

app.post("/api/search",async(req,res)=>{try{if(!requireAI(res))return;const query=typeof req.body?.query==="string"?req.body.query.trim():"";if(!query)return res.status(400).json({error:"Recherche vide."});const state=causal.step(query,"search",[]);const result=await generate({contents:query,config:{systemInstruction:SEARCH_INSTRUCTIONS+policy(state),tools:[{googleSearch:{}}],maxOutputTokens:2048}});const answer=textOf(result.response);if(!answer)return res.status(502).json({error:"Aucun résultat de recherche."});const g=groundingOf(result.response);res.json({answer,response:answer,model:result.model,search:true,groundingMetadata:g.metadata,sources:g.sources,supports:g.supports,queries:g.metadata?.webSearchQueries||g.metadata?.searchQueries||[],causal:{D:state.D,F:state.F}});}catch(e){sendError(res,e);}});

app.post("/api/image",async(req,res)=>{try{if(!requireAI(res))return;const prompt=typeof req.body?.prompt==="string"?req.body.prompt.trim():"";if(!prompt)return res.status(400).json({error:"Décris l'image à générer."});const state=causal.step(prompt,"image",[]);const result=await generateImage(prompt);res.json({ok:true,model:result.model,image:`data:image/jpeg;base64,${result.data}`,causal:{D:state.D,F:state.F}});}catch(e){sendError(res,e);}});

app.post("/api/analyze-file",upload.single("file"),async(req,res)=>{try{if(!requireAI(res))return;if(!req.file)return res.status(400).json({error:"Aucun fichier reçu."});const mime=req.file.mimetype||"application/octet-stream",allowed=["application/pdf","image/png","image/jpeg","image/webp"];if(!allowed.includes(mime))return res.status(415).json({error:"Type de fichier non pris en charge."});const prompt=typeof req.body?.prompt==="string"&&req.body.prompt.trim()?req.body.prompt.trim():"Analyse ce fichier et réponds à la demande de l'utilisateur. Si c'est un PDF, prends en compte le texte, les tableaux, graphiques et éléments visuels.";const state=causal.step(`${req.file.originalname}: ${prompt}`,"file",[]);const result=await generate({contents:[{role:"user",parts:[{text:prompt},{inlineData:{mimeType:mime,data:req.file.buffer.toString("base64")}}]}],config:{systemInstruction:BASE_INSTRUCTIONS+policy(state),maxOutputTokens:3072}});const answer=textOf(result.response);if(!answer)return res.status(502).json({error:"Aucune analyse n'a été retournée."});res.json({answer,model:result.model,file:{name:req.file.originalname,mimeType:mime,size:req.file.size},causal:{K:state.K,D:state.D,F:state.F,S:state.S}});}catch(e){sendError(res,e);}});

app.post("/api/consciousness",async(req,res)=>{try{if(!requireAI(res))return;const text=typeof req.body?.text==="string"?req.body.text.trim():"";if(!text)return res.status(400).json({error:"Texte manquant."});const state=causal.step(text,"analysis",[]);const result=await generate({contents:text,config:{systemInstruction:ANALYSIS_INSTRUCTIONS+policy(state),maxOutputTokens:1024}});res.json({analysis:textOf(result.response),functional:true,model:result.model,causal:{K:state.K,D:state.D,F:state.F,S:state.S}});}catch(e){sendError(res,e);}});

app.post("/api/analyze",async(req,res)=>{try{if(!requireAI(res))return;const text=typeof req.body?.text==="string"?req.body.text.trim():"";if(!text)return res.status(400).json({error:"Texte à analyser manquant."});const state=causal.step(text,"analysis",[]);const result=await generate({contents:text,config:{systemInstruction:ANALYSIS_INSTRUCTIONS+policy(state),maxOutputTokens:1024}});res.json({analysis:textOf(result.response),functional:true,model:result.model,causal:{D:state.D,F:state.F}});}catch(e){sendError(res,e);}});

app.use((err,req,res,next)=>{if(err?.code==="LIMIT_FILE_SIZE")return res.status(413).json({error:"Fichier trop volumineux. Taille maximale : 20 MB."});next(err);});
app.listen(PORT,"0.0.0.0",()=>console.log(`Wiener IA démarré sur 0.0.0.0:${PORT}`));
