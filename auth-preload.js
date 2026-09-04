"use strict";
const express=require("express");
const {authRoutes,initAuthDb}=require("./auth");
const originalListen=express.application.listen;
let installed=false;
express.application.listen=function(...args){
  if(!installed){
    installed=true;
    try{authRoutes(this);}catch(error){console.error("Wiener IA auth routes:",error);}
  }
  const start=()=>originalListen.apply(this,args);
  if(!process.env.DATABASE_URL)return start();
  initAuthDb().then(start).catch(error=>{console.error("Wiener IA auth database:",error);start();});
};
