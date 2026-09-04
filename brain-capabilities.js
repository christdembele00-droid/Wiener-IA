"use strict";

const CAPABILITIES = Object.freeze({
  conversation: true,
  multilingual: true,
  context: true,
  memory: true,
  webResearch: true,
  documents: true,
  vision: true,
  imageGeneration: true,
  coding: true,
  education: true,
  calculation: true,
  orchestration: true,
  verification: true,
  authentication: true,
  conversationManagement: true,
  voice: true,
  connectors: true,
  dataAnalysis: true,
  safety: true
});

function status(){
  return {
    name: "Wiener IA",
    brain: "autonomous-functional",
    version: "3.0",
    capabilities: CAPABILITIES,
    total: Object.keys(CAPABILITIES).length
  };
}

module.exports = { CAPABILITIES, status };
