"use strict";
const express=require("express");
const {authRoutes,initAuthDb}=require("./auth");
const originalListen=express.application.listen;
let installed=false;
const FRONTEND_ORIGIN=(process.env.FRONTEND_URL||"https://christdembele00-droid.github.io/Wiener-IA/").replace(/\/$/,"");
express.application.listen=function(...args){
  if(!installed){
    installed=true;
    try{
      const router=this.router||this._router;
      const before=router?.stack?.length||0;
      this.use((req,res,next)=>{const origin=req.headers.origin;if(origin===FRONTEND_ORIGIN){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Access-Control-Allow-Credentials","true");res.setHeader("Vary","Origin");}next();});
      authRoutes(this);
      const stack=router?.stack;
      if(stack&&stack.length>before){
        const added=stack.splice(before);
        const insertAt=Math.max(0,stack.length-2);
        stack.splice(insertAt,0,...added);
      }
    }catch(error){console.error("Wiener IA auth routes:",error);}
  }
  const start=()=>originalListen.apply(this,args);
  if(!process.env.DATABASE_URL)return start();
  initAuthDb().then(start).catch(error=>{console.error("Wiener IA auth database:",error);start();});
};
