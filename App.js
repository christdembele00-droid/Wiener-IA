import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';

const API = Constants.expoConfig?.extra?.apiUrl || 'https://us-central1-weiner-ia.cloudfunctions.net/api';

export default function App() {
  const [mode, setMode] = useState('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const placeholder = useMemo(() => ({
    chat: 'Message à Wiener IA…',
    search: 'Recherche Web…',
    exercise: 'Décris ton exercice…',
    image: 'Décris l’image à créer…',
  })[mode], [mode]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setBusy(true);

    try {
      let answer = '';
      let endpoint = '/api/chat';
      let body = { messages: [...messages, { role: 'user', content: text }] };

      if (mode === 'search') {
        endpoint = '/api/search';
        body = { query: text };
      } else if (mode === 'exercise') {
        endpoint = '/api/exercises';
        body = { question: text };
      } else if (mode === 'image') {
        endpoint = '/api/image';
        body = { prompt: text };
      }

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${response.status}`);
      }

      if (mode === 'chat') {
        const reader = response.body?.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split('\n\n');
            buffer = chunks.pop() || '';
            for (const chunk of chunks) {
              const line = chunk.split('\n').find((item) => item.startsWith('data: '));
              if (!line) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.text) answer += event.text;
              } catch (_) {}
            }
          }
        } else {
          const data = await response.json();
          answer = data.answer || data.response || '';
        }
      } else {
        const data = await response.json();
        answer = mode === 'image' ? (data.url ? `Image générée : ${data.url}` : 'Image générée.') : (data.answer || data.response || '');
      }

      setMessages((current) => [...current, { role: 'assistant', content: answer || 'Wiener IA n’a retourné aucune réponse.' }]);
    } catch (e) {
      setError(e?.message || 'Une erreur est survenue.');
      setMessages((current) => [...current, { role: 'assistant', content: 'Impossible de contacter Wiener IA pour le moment.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Wiener IA</Text>
            <Text style={styles.subtitle}>Intelligence personnelle · 2026</Text>
          </View>
          <View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>En ligne</Text></View>
        </View>

        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && (
            <View style={styles.welcome}>
              <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
              <Text style={styles.hero}>L’intelligence, sans serveur à gérer.</Text>
              <Text style={styles.description}>Discute, recherche, résous et crée avec Wiener IA.</Text>
            </View>
          )}

          {messages.map((message, index) => (
            <View key={`${index}-${message.role}`} style={[styles.messageRow, message.role === 'user' ? styles.userRow : styles.assistantRow]}>
              <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <Text style={message.role === 'user' ? styles.userText : styles.assistantText}>{message.content}</Text>
              </View>
            </View>
          ))}
          {busy && <ActivityIndicator size="small" />}
        </ScrollView>

        <View style={styles.modes}>
          {[
            ['chat', '✦ Chat'],
            ['search', '⌕ Web'],
            ['exercise', '∑ Exercice'],
            ['image', '◈ Image'],
          ].map(([value, label]) => (
            <Pressable key={value} onPress={() => setMode(value)} style={[styles.mode, mode === value && styles.modeActive]}>
              <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={placeholder}
            placeholderTextColor="#7f8999"
            multiline
            style={styles.input}
            editable={!busy}
            onSubmitEditing={() => { if (Platform.OS !== 'ios') send(); }}
          />
          <Pressable onPress={send} disabled={busy || !input.trim()} style={[styles.send, (!input.trim() || busy) && styles.sendDisabled]}>
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
        <Text style={styles.footer}>Gemini · Firestore · Cloudinary</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080a0f' },
  container: { flex: 1 },
  header: { height: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#252c38', backgroundColor: '#0b0e14' },
  title: { color: '#fff', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#8b94a5', fontSize: 11, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#42dfa0' },
  statusText: { color: '#42dfa0', fontSize: 11 },
  messages: { flex: 1 },
  messagesContent: { padding: 18, paddingBottom: 24 },
  welcome: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 20 },
  logo: { width: 76, height: 76, borderRadius: 23, backgroundColor: '#ff8a00', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoText: { fontSize: 34, fontWeight: '900', color: '#111' },
  hero: { color: '#f5f7fb', fontSize: 31, fontWeight: '800', textAlign: 'center', letterSpacing: -1 },
  description: { color: '#8b94a5', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  messageRow: { marginBottom: 14, width: '100%' },
  userRow: { alignItems: 'flex-end' },
  assistantRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '88%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 17 },
  userBubble: { backgroundColor: '#202733', borderWidth: 1, borderColor: '#343d4b' },
  assistantBubble: { backgroundColor: 'transparent' },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  assistantText: { color: '#e7ebf2', fontSize: 15, lineHeight: 23 },
  modes: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 7, borderTopWidth: 1, borderTopColor: '#252c38' },
  mode: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#141923', borderWidth: 1, borderColor: '#252c38', alignItems: 'center' },
  modeActive: { backgroundColor: '#ff8a00', borderColor: '#ff8a00' },
  modeText: { color: '#b9c1ce', fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: '#111' },
  composer: { marginHorizontal: 10, borderWidth: 1, borderColor: '#384250', backgroundColor: '#151a23', borderRadius: 20, padding: 7, flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, color: '#fff', minHeight: 44, maxHeight: 120, paddingHorizontal: 11, paddingVertical: 10, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: '#111', fontSize: 18, fontWeight: '900' },
  error: { color: '#ff9c42', fontSize: 11, paddingHorizontal: 16, paddingBottom: 5 },
  footer: { color: '#667080', fontSize: 9, textAlign: 'center', paddingVertical: 7 },
});
