import type { Unsubscribe } from "firebase/auth";
import {
  collection,
  getFirestore,
  limit,
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

function toConversationMessage(
  messageSnapshot: {
    id: string;
    data: () => Record<string, unknown>;
  },
): ConversationMessage {
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
    ...(data.editedAt instanceof Timestamp
      ? { editedAt: data.editedAt.toDate().toISOString() }
      : {}),
  };
}

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
            onMessages(snapshot.docs.map(toConversationMessage));
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

export function subscribeToLatestConversationMessage(
  conversationId: string,
  expectedUid: string,
  onMessage: (
    message: ConversationMessage | null,
    isInitialSnapshot: boolean,
    isNewMessage: boolean,
  ) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let cancelled = false;
  let receivedInitialSnapshot = false;
  let previousLatestMessage: ConversationMessage | null = null;
  let unsubscribe: Unsubscribe = () => undefined;

  void verifyCurrentFirebaseUser(expectedUid)
    .then(() => {
      if (cancelled) {
        return;
      }

      const database = getFirestore(getFirebaseApp());
      const latestMessageQuery = query(
        collection(
          database,
          "conversation_firebase",
          conversationId,
          "messages",
        ),
        orderBy("createdAt", "desc"),
        limit(1),
      );

      unsubscribe = onSnapshot(
        latestMessageQuery,
        (snapshot) => {
          try {
            const latestMessage = snapshot.docs[0];
            const message = latestMessage
              ? toConversationMessage(latestMessage)
              : null;
            const isNewMessage = Boolean(
              receivedInitialSnapshot &&
                message &&
                message.id !== previousLatestMessage?.id &&
                (!previousLatestMessage ||
                  Date.parse(message.createdAt) >=
                    Date.parse(previousLatestMessage.createdAt)),
            );
            onMessage(
              message,
              !receivedInitialSnapshot,
              isNewMessage,
            );
            receivedInitialSnapshot = true;
            previousLatestMessage = message;
          } catch (error) {
            onError(
              error instanceof Error
                ? error
                : new Error("Unable to read the latest chat message"),
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
