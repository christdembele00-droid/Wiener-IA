"use strict";

const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const {onInit}=require("firebase-functions/v2/core");

const geminiApiKey=defineSecret("GEMINI_API_KEY");
const cloudinaryUrl=defineSecret("CLOUDINARY_URL");
const firebaseWebApiKey=defineSecret("FIREBASE_WEB_API_KEY");

let app=null;

onInit(()=>{
  process.env.GEMINI_API_KEY=geminiApiKey.value();
  process.env.CLOUDINARY_URL=cloudinaryUrl.value();
  process.env.FIREBASE_WEB_API_KEY=firebaseWebApiKey.value();

  const expressPath=require.resolve("express");
  const expressFactory=require(expressPath);
  let capturedApp=null;
  require.cache[expressPath].exports=(...args)=>{
    capturedApp=expressFactory(...args);
    const originalListen=capturedApp.listen.bind(capturedApp);
    capturedApp.listen=()=>capturedApp;
    void originalListen;
    return capturedApp;
  };

  require("./server");
  app=capturedApp;
  if(!app)throw new Error("Impossible d'initialiser l'application Wiener IA.");
});

exports.api=onRequest(
  {
    region:"us-central1",
    timeoutSeconds:540,
    memory:"1GiB",
    secrets:[geminiApiKey,cloudinaryUrl,firebaseWebApiKey]
  },
  (req,res)=>{
    if(!app)return res.status(503).json({error:"Wiener IA est en cours d'initialisation."});
    return app(req,res);
  }
);
