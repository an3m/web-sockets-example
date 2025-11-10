// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';
import { ChatsService } from '../chats/chats.service';
import { UsersService } from '../users/users.service';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { JwtPayload } from 'src/auth/interfaces';
import { MessageType } from 'src/messages/schemas/message.schema';
import { Types } from 'mongoose';
import { WsAuthGuard } from 'src/auth/guards/ws-auth.guard';

export interface AuthenticatedSocket extends Socket {
  user?: User & { _id: string };
}

@UseGuards(WsAuthGuard)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
  transports: ['websocket', 'polling'],
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ChatGateway');

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
    private chatsService: ChatsService,
    private usersService: UsersService,
  ) { }

  async handleConnection(client: AuthenticatedSocket) {
    // console.log("HANDLE CONNECTION", client.user)
    try {
      const token = client.handshake?.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new WsException('Missing authentication token');
      }
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        client.emit('unauthorized', { message: 'User not found' });
        client.disconnect();
      }
      client.user = {
        ...user,
        _id: user._id.toString(),
      };

      // Join user to their personal room and all their chat rooms
      await client.join(`user_${user._id.toString()}`);


      const userChats = await this.chatsService.findUserChats(user._id.toString());
      for (const chat of userChats) {
        await client.join(`chat_${chat._id.toString()}`);
        client.emit('joinedChat', { chatId: chat._id.toString() });
      }

      // Notify others that user is online, subscribe to their status
      this.server.emit('userOnline', { userId: user._id, username: user.username });
    } catch (error) {
      this.logger.error('Authentication failed', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.logger.log(`Client disconnected: ${client.user.username}`);

      // Update last seen
      await this.usersService.updateUser(client.user._id.toString(), {
        lastSeen: new Date(),
      });

      // Notify others that user is offline
      this.server.emit('userOffline', {
        userId: client.user._id,
        username: client.user.username
      });
    }
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    // console.log(client)
    if (!client.user) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }
    const chat = await this.chatsService.findChatById(data.chatId);
    console.log(chat, data)

    // Check if user is participant
    const isParticipant = chat.participants.some(p => p._id.equals(new Types.ObjectId(client.user?._id)));

    if (isParticipant) {
      await client.join(`chat_${data.chatId}`);
      this.logger.log(`User ${client.user.username} joined chat ${data.chatId}`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string; content: string; type: MessageType },
  ) {
    try {
      const chat = await this.chatsService.findChatById(data.chatId);

      // Verify user is participant
      const isParticipant = chat.participants.some(p => p._id.equals(new Types.ObjectId(client.user?._id))
        // participant => participant._id.toString() === client.user._id.toString(),
      );

      if (!isParticipant) {
        client.emit('error', { message: 'Not a participant in this chat' });
        return;
      }

      const message = await this.messagesService.createMessage({
        chatId: new Types.ObjectId(data.chatId),
        senderId: new Types.ObjectId(client.user?._id),
        content: data.content,
        type: data.type || MessageType.TEXT,
      });

      // Broadcast message to all participants in the chat
      this.server.to(`chat_${data.chatId}`).emit('newMessage', message);

      // Update last seen for sender in their personal room
      client.to(`user_${client.user?._id}`).emit('messageSent', message);

    } catch (error) {
      this.logger.error('Error sending message', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  // @SubscribeMessage('markAsRead')
  // async handleMarkAsRead(
  //   @ConnectedSocket() client: AuthenticatedSocket,
  //   @MessageBody() data: { messageId: string },
  // ) {
  //   try {
  //     const message = await this.messagesService.markAsRead(
  //       data.messageId,
  //       client.user._id.toString(),
  //     );

  //     // Notify sender that message was read
  //     this.server.to(`user_${message.senderId.toString()}`).emit('messageRead', {
  //       messageId: data.messageId,
  //       readBy: client.user._id,
  //     });

  //   } catch (error) {
  //     this.logger.error('Error marking message as read', error);
  //     client.emit('error', { message: 'Failed to mark message as read' });
  //   }
  // }

  // @SubscribeMessage('typing')
  // handleTyping(
  //   @ConnectedSocket() client: AuthenticatedSocket,
  //   @MessageBody() data: { chatId: string; isTyping: boolean },
  // ) {
  //   // Notify other participants in the chat
  //   client.to(`chat_${data.chatId}`).emit('userTyping', {
  //     userId: client.user._id,
  //     username: client.user.username,
  //     isTyping: data.isTyping,
  //   });
  // }
}