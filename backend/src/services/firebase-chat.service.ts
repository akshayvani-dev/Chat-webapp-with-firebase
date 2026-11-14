import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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
  editedAt?: string;
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

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageId: id,
      lastMessage: text,
      lastMessageSenderId: authenticatedUserId,
      lastMessageAt: createdAt,
    },
  });

  return {
    id,
    text,
    senderId: authenticatedUserId,
    createdAt: createdAt.toISOString(),
  };
}

async function getConversationForParticipant(
  authenticatedUserId: string,
  conversationId: string,
) {
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

  return conversation;
}

function getMessageRef(
  conversationId: string,
  messageId: string,
) {
  if (!uuidPattern.test(messageId)) {
    throw new AppError(404, "Message not found");
  }

  return firestore
    .collection("conversation_firebase")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId);
}

export async function editConversationMessage(
  authenticatedUserId: string,
  conversationId: string,
  messageId: string,
  text: string,
): Promise<ConversationMessage> {
  const conversation = await getConversationForParticipant(
    authenticatedUserId,
    conversationId,
  );
  const messageRef = getMessageRef(conversation.id, messageId);
  let snapshot;
  try {
    snapshot = await messageRef.get();
  } catch (error) {
    logFirebaseChatError("readMessageForEdit", error);
    throw new AppError(503, "Unable to load message for editing");
  }

  if (!snapshot.exists) {
    throw new AppError(404, "Message not found");
  }

  if (snapshot.get("senderId") !== authenticatedUserId) {
    throw new AppError(403, "You can only edit your own messages");
  }

  const createdAt = snapshot.get("createdAt");
  if (!(createdAt instanceof Timestamp)) {
    throw new AppError(500, "Message has invalid creation time");
  }

  const editedAt = new Date();
  try {
    await messageRef.update({
      text,
      editedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logFirebaseChatError("editMessage", error);
    throw new AppError(503, "Unable to edit message");
  }

  try {
    await prisma.conversation.updateMany({
      where: { id: conversation.id, lastMessageId: messageId },
      data: { lastMessage: text },
    });
  } catch (error) {
    console.error("Failed to sync edited message to conversation preview", error);
    throw new AppError(
      503,
      "Message was edited, but the conversation preview could not be updated",
    );
  }

  return {
    id: snapshot.id,
    text,
    senderId: authenticatedUserId,
    createdAt: createdAt.toDate().toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

export async function deleteConversationMessage(
  authenticatedUserId: string,
  conversationId: string,
  messageId: string,
): Promise<ConversationMessage | null> {
  const conversation = await getConversationForParticipant(
    authenticatedUserId,
    conversationId,
  );
  const messageRef = getMessageRef(conversation.id, messageId);
  let snapshot;
  try {
    snapshot = await messageRef.get();
  } catch (error) {
    logFirebaseChatError("readMessageForDelete", error);
    throw new AppError(503, "Unable to load message for deletion");
  }

  if (!snapshot.exists) {
    throw new AppError(404, "Message not found");
  }

  if (snapshot.get("senderId") !== authenticatedUserId) {
    throw new AppError(403, "You can only delete your own messages");
  }

  try {
    await messageRef.delete();
  } catch (error) {
    logFirebaseChatError("deleteMessage", error);
    throw new AppError(503, "Unable to delete message");
  }

  let latestSnapshot;
  try {
    latestSnapshot = await firestore
      .collection("conversation_firebase")
      .doc(conversation.id)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
  } catch (error) {
    logFirebaseChatError("findLatestMessage", error);
    throw new AppError(
      503,
      "Message was deleted, but the conversation preview could not be updated",
    );
  }
  const latestDoc = latestSnapshot.docs[0];
  const latestData = latestDoc?.data();
  const latestCreatedAt = latestData?.createdAt;
  const latestMessage =
    latestDoc &&
    typeof latestData?.text === "string" &&
    typeof latestData.senderId === "string" &&
    latestCreatedAt instanceof Timestamp
      ? {
          id: latestDoc.id,
          text: latestData.text,
          senderId: latestData.senderId,
          createdAt: latestCreatedAt.toDate().toISOString(),
          ...(latestData.editedAt instanceof Timestamp
            ? { editedAt: latestData.editedAt.toDate().toISOString() }
            : {}),
        }
      : null;

  try {
    await prisma.conversation.updateMany({
      where: { id: conversation.id, lastMessageId: messageId },
      data: latestMessage
        ? {
            lastMessageId: latestMessage.id,
            lastMessage: latestMessage.text,
            lastMessageSenderId: latestMessage.senderId,
            lastMessageAt: new Date(latestMessage.createdAt),
          }
        : {
            lastMessageId: null,
            lastMessage: null,
            lastMessageSenderId: null,
            lastMessageAt: null,
          },
    });
  } catch (error) {
    console.error("Failed to sync deleted message to conversation preview", error);
    throw new AppError(
      503,
      "Message was deleted, but the conversation preview could not be updated",
    );
  }

  return latestMessage;
}
