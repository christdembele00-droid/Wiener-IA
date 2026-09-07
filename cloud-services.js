"use strict";

const crypto = require("crypto");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { v2: cloudinary } = require("cloudinary");

let db = null;
let firebaseReady = false;
let cloudinaryReady = false;

function initFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "weiner-ia";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return false;
  try {
    const app = getApps().length ? getApps()[0] : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
    db = getFirestore(app);
    firebaseReady = true;
    return true;
  } catch (error) {
    console.error("Firebase initialization:", error.message);
    return false;
  }
}

function initCloudinary() {
  // Support either the three separate Render variables or Cloudinary's
  // standard CLOUDINARY_URL. Secrets remain server-side only.
  const cloudUrl = process.env.CLOUDINARY_URL;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudUrl) {
    try {
      cloudinary.config({ cloudinary_url: cloudUrl, secure: true });
      cloudinaryReady = Boolean(cloudinary.config().cloud_name);
      return cloudinaryReady;
    } catch (error) {
      console.error("Cloudinary initialization:", error.message);
      return false;
    }
  }

  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  cloudinaryReady = true;
  return true;
}

initFirebase();
initCloudinary();

function safeId(value, fallback) {
  const id = String(value || fallback || "").trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : fallback;
}

function getUserId(req) {
  return safeId(req.get("x-user-id"), null);
}

function getConversationId(req) {
  return safeId(req.get("x-conversation-id"), null);
}

async function ensureUser(userId) {
  if (!firebaseReady || !userId) return;
  const ref = db.collection("users").doc(userId);
  await ref.set({
    id: userId,
    updatedAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function ensureConversation(userId, conversationId, title, mode = "chat") {
  if (!firebaseReady || !userId || !conversationId) return;
  await ensureUser(userId);
  const ref = db.collection("conversations").doc(conversationId);
  await ref.set({
    id: conversationId,
    userId,
    title: String(title || "Conversation").slice(0, 120),
    mode,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function saveMessage({ userId, conversationId, role, content, mode = "chat", attachments = [] }) {
  if (!firebaseReady || !userId || !conversationId || !content) return null;
  await ensureConversation(userId, conversationId, String(content).slice(0, 80), mode);
  const ref = db.collection("conversations").doc(conversationId).collection("messages").doc();
  await ref.set({
    id: ref.id,
    userId,
    conversationId,
    role,
    content: String(content).slice(0, 20000),
    mode,
    attachments: Array.isArray(attachments) ? attachments : [],
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function saveMedia({ userId, conversationId, file, folder = "wiener-ia/uploads", source = "upload" }) {
  if (!cloudinaryReady || !file?.buffer) throw new Error("Cloudinary n'est pas configuré.");
  const resourceType = file.mimetype?.startsWith("image/") ? "image" : "raw";
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      context: { source }
    }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
    stream.end(file.buffer);
  });

  const metadata = {
    userId: userId || null,
    conversationId: conversationId || null,
    url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
    type: result.type,
    format: result.format || null,
    bytes: result.bytes || file.size || file.buffer.length,
    width: result.width || null,
    height: result.height || null,
    originalName: file.originalname || null,
    mimeType: file.mimetype || null,
    source,
    createdAt: FieldValue.serverTimestamp()
  };

  if (firebaseReady) {
    const ref = db.collection("media").doc();
    await ref.set({ id: ref.id, ...metadata });
    return { id: ref.id, ...metadata };
  }
  return metadata;
}

async function saveGeneratedImage({ userId, conversationId, base64, mimeType = "image/png", prompt = "" }) {
  const ext = mimeType.split("/")[1] || "png";
  return saveMedia({
    userId,
    conversationId,
    source: "generated",
    folder: "wiener-ia/generated",
    file: {
      buffer: Buffer.from(base64, "base64"),
      mimetype: mimeType,
      originalname: `wiener-ia-${crypto.randomUUID()}.${ext}`,
      size: Buffer.byteLength(base64, "base64")
    },
    prompt
  });
}

async function listConversations(userId) {
  if (!firebaseReady || !userId) return [];
  const snap = await db.collection("conversations").where("userId", "==", userId).orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function listMessages(userId, conversationId) {
  if (!firebaseReady || !userId || !conversationId) return [];
  const conv = await db.collection("conversations").doc(conversationId).get();
  if (!conv.exists || conv.data().userId !== userId) return [];
  const snap = await db.collection("conversations").doc(conversationId).collection("messages").orderBy("createdAt", "asc").limit(500).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  get firebaseReady() { return firebaseReady; },
  get cloudinaryReady() { return cloudinaryReady; },
  getUserId,
  getConversationId,
  ensureUser,
  ensureConversation,
  saveMessage,
  saveMedia,
  saveGeneratedImage,
  listConversations,
  listMessages
};
