import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { Chat } from './entities/chat.entity';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

@Injectable()
export class ChatService {
  private messages: Map<string, Chat> = new Map(); // Use Map for O(1) lookup
  private messagesByRoom: Map<string, string[]> = new Map(); // room -> messageIds[]
  private messageCounter = 0;

  create(
    createChatDto: CreateChatDto,
    username: string,
    userId: string,
    room: string = 'general',
  ): Chat {
    const messageId = `${Date.now()}-${++this.messageCounter}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    
    const chat: Chat = {
      id: messageId,
      username,
      userId,
      message: createChatDto.message.trim(),
      timestamp: new Date(),
      editedAt: undefined,
      isEdited: false,
      isDeleted: false,
      room,
      messageType: 'text',
    };

    this.messages.set(messageId, chat);

    // Index by room
    if (!this.messagesByRoom.has(room)) {
      this.messagesByRoom.set(room, []);
    }
    this.messagesByRoom.get(room)!.push(messageId);

    return chat;
  }

  findOne(messageId: string): Chat | null {
    return this.messages.get(messageId) || null;
  }

  findAll(room?: string): Chat[] {
    if (room) {
      const messageIds = this.messagesByRoom.get(room) || [];
      return messageIds
        .map((id) => this.messages.get(id))
        .filter((msg): msg is Chat => msg !== undefined && !msg.isDeleted)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    // Return all non-deleted messages, sorted by timestamp
    return Array.from(this.messages.values())
      .filter((msg) => !msg.isDeleted)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getRecentMessages(limit: number = 50, room?: string): Chat[] {
    const messages = this.findAll(room);
    return messages.slice(-limit);
  }

  getMessagesByPage(
    page: number = 1,
    limit: number = 20,
    room?: string,
  ): { messages: Chat[]; total: number; page: number; totalPages: number } {
    const allMessages = this.findAll(room);
    const total = allMessages.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const messages = allMessages.slice(startIndex, endIndex);

    return {
      messages,
      total,
      page,
      totalPages,
    };
  }

  editMessage(
    editDto: EditMessageDto,
    userId: string,
  ): Chat {
    const message = this.messages.get(editDto.messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new Error('You can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new Error('Cannot edit a deleted message');
    }

    message.message = editDto.newMessage.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    return message;
  }

  deleteMessage(deleteDto: DeleteMessageDto, userId: string): Chat {
    const message = this.messages.get(deleteDto.messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new Error('You can only delete your own messages');
    }

    if (message.isDeleted) {
      throw new Error('Message already deleted');
    }

    // Soft delete - mark as deleted but keep in storage
    message.isDeleted = true;
    message.message = '[This message was deleted]';

    return message;
  }

  getUserMessages(userId: string, room?: string): Chat[] {
    const messages = this.findAll(room);
    return messages.filter((msg) => msg.userId === userId);
  }

  searchMessages(query: string, room?: string): Chat[] {
    const messages = this.findAll(room);
    const lowerQuery = query.toLowerCase();
    return messages.filter(
      (msg) =>
        msg.message.toLowerCase().includes(lowerQuery) ||
        msg.username.toLowerCase().includes(lowerQuery),
    );
  }

  getRoomStats(room: string): {
    totalMessages: number;
    activeUsers: number;
    lastMessageAt?: Date;
  } {
    const messages = this.findAll(room);
    const uniqueUsers = new Set(messages.map((msg) => msg.userId));
    const lastMessage = messages[messages.length - 1];

    return {
      totalMessages: messages.length,
      activeUsers: uniqueUsers.size,
      lastMessageAt: lastMessage?.timestamp,
    };
  }

  // Cleanup method for old messages (optional - for memory management)
  cleanupOldMessages(daysOld: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;
    for (const [id, message] of this.messages.entries()) {
      if (message.timestamp < cutoffDate && message.isDeleted) {
        this.messages.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
