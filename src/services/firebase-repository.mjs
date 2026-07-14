import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export class FirebaseRepository {
  constructor(config) {
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.db = initializeFirestore(this.app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    this.activeSubscriptions = new Map();
  }

  subscribeMessages(chatId, callback, onError = console.error) {
    const key = String(chatId);
    this.activeSubscriptions.get(key)?.();
    let active = true;
    const messagesQuery = query(collection(this.db, 'chats', key, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(messagesQuery, { includeMetadataChanges: true }, (snapshot) => {
      if (!active) return;
      const messages = snapshot.docs.map((entry) => ({ id: String(entry.id), ...entry.data() }));
      callback(messages, { fromCache: snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites });
    }, onError);
    const safeUnsubscribe = () => {
      if (!active) return;
      active = false;
      unsubscribe();
      if (this.activeSubscriptions.get(key) === safeUnsubscribe) this.activeSubscriptions.delete(key);
    };
    this.activeSubscriptions.set(key, safeUnsubscribe);
    return safeUnsubscribe;
  }

  async sendMessage(chatId, draft, idempotencyKey) {
    const key = String(chatId);
    const id = String(draft.id);
    await setDoc(doc(this.db, 'chats', key, 'messages', id), {
      ...draft,
      idempotencyKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: false });
  }

  async deleteMessage(chatId, messageId, idempotencyKey) {
    const ref = doc(this.db, 'chats', String(chatId), 'messages', String(messageId));
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) throw new Error('message-not-found');
    await deleteDoc(ref);
  }

  async forwardMessage(dto) {
    await setDoc(doc(this.db, 'chats', String(dto.chatId), 'messages', String(dto.id)), {
      ...dto,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: false });
  }

  async pinMessage(chatId, messageId, idempotencyKey) {
    await updateDoc(doc(this.db, 'chats', String(chatId)), {
      pinnedMessageId: String(messageId),
      pinOperationId: idempotencyKey,
      updatedAt: serverTimestamp()
    });
  }

  dispose() {
    for (const unsubscribe of this.activeSubscriptions.values()) unsubscribe();
    this.activeSubscriptions.clear();
  }
}
