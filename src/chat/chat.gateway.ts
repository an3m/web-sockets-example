import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

interface UserSession {
  username: string;
  userId: string;
  room: string;
  joinedAt: Date;
  lastMessageAt?: Date;
  messageCount: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ChatGateway');
  private userSessions: Map<string, UserSession> = new Map(); // socketId -> UserSession
  private messageRateLimits: Map<string, number[]> = new Map(); // userId -> timestamps
  private readonly MAX_MESSAGE_LENGTH = 1000;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_MESSAGES_PER_WINDOW = 10;

  constructor(private readonly chatService: ChatService) { }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('Chat Gateway initialized');
    this.server.emit('serverTime', { time: new Date() });
    // Server parameter required by OnGatewayInit interface
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

  }

  handleDisconnect(client: Socket) {
    const session = this.userSessions.get(client.id);
    if (session) {
      this.logger.log(
        `Client disconnected: ${client.id} (${session.username}) from room ${session.room}`,
      );

      // Notify others in the room that user left
      this.server.to(session.room).emit('userLeft', {
        username: session.username,
        timestamp: new Date(),
        message: `${session.username} left the chat`,
      });

      // Clean up
      this.userSessions.delete(client.id);
      this.messageRateLimits.delete(session.userId);

      // Broadcast updated online users
      this.broadcastOnlineUsers(session.room);
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }


  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() joinRoomDto: JoinRoomDto,
  ) {

    // room defaults to 'general' if not provided
    const { username, room = 'general' } = joinRoomDto;

    // Validate username
    if (!username || username.trim() === '') {
      return { error: 'Username is required' };
    }

    if (username.length > 20) {
      return { error: 'Username must be 20 characters or less' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return {
        error: 'Username can only contain letters, numbers, and underscores',
      };
    }

    // Check if username already exists in the room, 
    // we used Array.from to search through the Map values
    const existingUser = Array.from(this.userSessions.values()).find(
      (s) => s.username.toLowerCase() === username.toLowerCase() && s.room === room,
    );

    if (existingUser) {
      return { error: 'Username already taken in this room' };
    }

    // Leave previous room if exists
    const previousSession = this.userSessions.get(client.id);
    if (previousSession) {
      void client.leave(previousSession.room);
      // Notify others in the previous room
      this.server.to(previousSession.room).emit('userLeft', {
        username: previousSession.username,
        timestamp: new Date(),
      });
    }

    // Create new session
    const session: UserSession = {
      username: username.trim(),
      userId: client.id,
      room,
      joinedAt: new Date(),
      messageCount: 0,
    };

    this.userSessions.set(client.id, session);
    void client.join(room);

    this.logger.log(`${username} joined room: ${room}`);

    // Notify others in the room
    this.server.to(room).emit('userJoined', {
      username,
      timestamp: new Date(),
      message: `${username} joined the chat`,
    });

    // Send recent messages for this room
    const recentMessages = this.chatService.getRecentMessages(50, room);
    client.emit('recentMessages', recentMessages);

    // Send room stats
    const stats = this.chatService.getRoomStats(room);
    client.emit('roomStats', stats);

    // Broadcast updated online users
    this.broadcastOnlineUsers(room);

    return {
      success: true,
      message: `Joined room ${room}`,
      username,
      room,
    };
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() createChatDto: CreateChatDto,
  ) {
    const session = this.userSessions.get(client.id);

    if (!session) {
      return { error: 'Please join the chat first' };
    }

    // Validate message
    if (!createChatDto.message || createChatDto.message.trim() === '') {
      return { error: 'Message cannot be empty' };
    }

    if (createChatDto.message.length > this.MAX_MESSAGE_LENGTH) {
      return {
        error: `Message must be ${this.MAX_MESSAGE_LENGTH} characters or less`,
      };
    }

    // Rate limiting
    if (!this.checkRateLimit(session.userId)) {
      return {
        error: 'Message rate limit exceeded. Please slow down.',
      };
    }

    // Use room from session or from DTO
    const room = createChatDto.room || session.room;

    // Create the chat message
    const chatMessage = this.chatService.create(
      createChatDto,
      session.username,
      session.userId,
      room,
    );

    // Update session
    session.lastMessageAt = new Date();
    session.messageCount++;

    // Broadcast to users in the same room
    this.server.to(room).emit('message', chatMessage);

    this.logger.log(
      `Message from ${session.username} in ${room}: ${createChatDto.message.substring(0, 50)}...`,
    );

    return { success: true, message: chatMessage };
  }

  @SubscribeMessage('editMessage')
  handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() editDto: EditMessageDto,
  ) {
    const session = this.userSessions.get(client.id);

    if (!session) {
      return { error: 'Please join the chat first' };
    }

    if (!editDto.newMessage || editDto.newMessage.trim() === '') {
      return { error: 'Message cannot be empty' };
    }

    if (editDto.newMessage.length > this.MAX_MESSAGE_LENGTH) {
      return {
        error: `Message must be ${this.MAX_MESSAGE_LENGTH} characters or less`,
      };
    }

    try {
      const editedMessage = this.chatService.editMessage(
        editDto,
        session.userId,
      );

      // Broadcast to users in the same room
      this.server.to(session.room).emit('messageEdited', editedMessage);

      this.logger.log(
        `Message ${editDto.messageId} edited by ${session.username}`,
      );

      return { success: true, message: editedMessage };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return { error: errorMessage };
    }
  }

  @SubscribeMessage('deleteMessage')
  handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() deleteDto: DeleteMessageDto,
  ) {
    const session = this.userSessions.get(client.id);

    if (!session) {
      return { error: 'Please join the chat first' };
    }

    try {
      const deletedMessage = this.chatService.deleteMessage(
        deleteDto,
        session.userId,
      );

      // Broadcast to users in the same room
      this.server.to(session.room).emit('messageDeleted', deletedMessage);

      this.logger.log(
        `Message ${deleteDto.messageId} deleted by ${session.username}`,
      );

      return { success: true, message: deletedMessage };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return { error: errorMessage };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isTyping: boolean },
  ) {
    const session = this.userSessions.get(client.id);
    if (session) {
      // Broadcast typing status to other clients in the same room
      client.to(session.room).emit('typing', {
        username: session.username,
        isTyping: data.isTyping,
      });
    }
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const session = this.userSessions.get(client.id);
    if (session) {
      const onlineUsers = this.getOnlineUsers(session.room);
      return { success: true, users: onlineUsers };
    }
    return { error: 'Not joined to any room' };
  }

  @SubscribeMessage('searchMessages')
  handleSearchMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { query: string; room?: string },
  ) {
    const session = this.userSessions.get(client.id);
    if (!session) {
      return { error: 'Please join the chat first' };
    }

    if (!data.query || data.query.trim() === '') {
      return { error: 'Search query is required' };
    }

    const room = data.room || session.room;
    const results = this.chatService.searchMessages(data.query, room);

    return { success: true, results, query: data.query };
  }

  // Helper methods
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const timestamps = this.messageRateLimits.get(userId) || [];

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(
      (ts) => now - ts < this.RATE_LIMIT_WINDOW,
    );

    if (validTimestamps.length >= this.MAX_MESSAGES_PER_WINDOW) {
      return false;
    }

    validTimestamps.push(now);
    this.messageRateLimits.set(userId, validTimestamps);
    return true;
  }

  private getOnlineUsers(room: string): string[] {
    return Array.from(this.userSessions.values())
      .filter((session) => session.room === room)
      .map((session) => session.username)
      .sort();
  }

  private broadcastOnlineUsers(room: string): void {
    const onlineUsers = this.getOnlineUsers(room);
    this.server.to(room).emit('onlineUsers', {
      users: onlineUsers,
      count: onlineUsers.length,
    });
  }
}
