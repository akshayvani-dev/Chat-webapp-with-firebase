import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../config/firebase.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ConversationMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
};

function logFirebaseChatError(operation: string, error: unknown): void {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "unknown";
  console.error("Firebase chat operation failed", { operation, code });
}

export async function syncFirestoreConversation(
  conversationId: string,
  participantIds: readonly string[],
): Promise<void> {
  if (
    !uuidPattern.test(conversationId) ||
    participantIds.length !== 2 ||
    participantIds[0] === participantIds[1]
  ) {
    throw new AppError(500, "Invalid conversation metadata");
  }

  const participants = [...participantIds].sort();
  try {
    await firestore
      .collection("conversation_firebase")
      .doc(conversationId)
      .set({ participants }, { merge: true });
  } catch (error) {
    logFirebaseChatError("syncConversation", error);
    throw new AppError(503, "Unable to prepare the conversation for chat");
  }
}

export async function sendConversationMessage(
  authenticatedUserId: string,
  conversationId: string,
  text: string,
): Promise<ConversationMessage> {
  if (!uuidPattern.test(conversationId)) {
    throw new AppError(404, "Conversation not found");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, participants: true },
  });

  if (
    !conversation ||
    conversation.participants.length !== 2 ||
    !conversation.participants.includes(authenticatedUserId)
  ) {
    throw new AppError(404, "Conversation not found");
  }

  await syncFirestoreConversation(conversation.id, conversation.participants);

  const id = randomUUID();
  const messageRef = firestore
    .collection("conversation_firebase")
    .doc(conversation.id)
    .collection("messages")
    .doc(id);
  const createdAt = new Date();

  try {
    await messageRef.create({
      text,
      senderId: authenticatedUserId,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logFirebaseChatError("createMessage", error);
    throw new AppError(503, "Unable to send message");
  }

  return {
    id,
    text,
    senderId: authenticatedUserId,
    createdAt: createdAt.toISOString(),
  };
}
