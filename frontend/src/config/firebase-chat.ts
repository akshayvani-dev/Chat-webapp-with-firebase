import type { Unsubscribe } from "firebase/auth";
import {
  collection,
  getFirestore,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import type { ConversationMessage } from "../types/chat.types";
import {
  getFirebaseApp,
  verifyCurrentFirebaseUser,
} from "./firebase";

const MAX_LIVE_MESSAGES = 100;

export function subscribeToConversationMessages(
  conversationId: string,
  expectedUid: string,
  onMessages: (messages: ConversationMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let cancelled = false;
  let unsubscribe: Unsubscribe = () => undefined;

  void verifyCurrentFirebaseUser(expectedUid)
    .then(() => {
      if (cancelled) {
        return;
      }

      const database = getFirestore(getFirebaseApp());
      const messagesQuery = query(
        collection(
          database,
          "conversation_firebase",
          conversationId,
          "messages",
        ),
        orderBy("createdAt", "asc"),
        limitToLast(MAX_LIVE_MESSAGES),
      );

      unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          try {
            const messages = snapshot.docs.map((messageSnapshot) => {
              const data = messageSnapshot.data();
              if (
                typeof data.text !== "string" ||
                typeof data.senderId !== "string" ||
                !(data.createdAt instanceof Timestamp)
              ) {
                throw new Error("A chat message has invalid data");
              }

              return {
                id: messageSnapshot.id,
                text: data.text,
                senderId: data.senderId,
                createdAt: data.createdAt.toDate().toISOString(),
              };
            });
            onMessages(messages);
          } catch (error) {
            onError(
              error instanceof Error
                ? error
                : new Error("Unable to read chat messages"),
            );
          }
        },
        onError,
      );
    })
    .catch(onError);

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
