import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../../services/auth';

interface ChatMessage {
  id: number;
  message: string;
  reply: string | null;
  created_at: string;
}

export default function SupportScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMessages(); }, []);

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/support`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Load messages error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) { Alert.alert('Ошибка', 'Введите сообщение'); return; }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage('');
        await loadMessages();
        Alert.alert('Успех', 'Сообщение отправлено');
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Поддержка</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => String(item.id)}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>Нет сообщений</Text>
            <Text style={styles.emptySubtext}>Напишите нам, если есть вопросы</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.messageCard}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageDate}>{new Date(item.created_at).toLocaleString('ru-RU')}</Text>
            </View>
            <Text style={styles.messageText}>{item.message}</Text>
            {item.reply && (
              <View style={styles.replyBox}>
                <Text style={styles.replyLabel}>Ответ поддержки:</Text>
                <Text style={styles.replyText}>{item.reply}</Text>
              </View>
            )}
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Напишите сообщение..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          <Text style={styles.sendText}>{sending ? '...' : '📤'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, color: '#e67e22' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  messagesList: { flex: 1 },
  messagesContent: { padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#666' },
  emptySubtext: { fontSize: 13, color: '#999', marginTop: 4 },
  messageCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  messageHeader: { marginBottom: 8 },
  messageDate: { fontSize: 11, color: '#999' },
  messageText: { fontSize: 15, color: '#1a1a1a', lineHeight: 22 },
  replyBox: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginTop: 12 },
  replyLabel: { fontSize: 11, color: '#2e7d32', fontWeight: '600', marginBottom: 4 },
  replyText: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: 24 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, padding: 12, fontSize: 15, backgroundColor: '#fafafa', marginRight: 8, maxHeight: 100 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e67e22', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontSize: 20 },
});
