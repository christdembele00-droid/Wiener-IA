import React, { useEffect, useMemo, useState } from 'react';
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
import { fetch as expoFetch } from 'expo/fetch';

const API = String(Constants.expoConfig?.extra?.apiUrl || 'https://us-central1-weiner-ia.cloudfunctions.net/api').replace(/\/$/, '');

function makeConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}