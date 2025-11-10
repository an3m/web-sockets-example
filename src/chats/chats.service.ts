import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument, ChatModel, ChatType } from './schemas/chat.schema';

@Injectable()
export class ChatsService {
    constructor(@InjectModel(Chat.name) private chatModel: Model<ChatDocument>) { }

    async createChat(chatData: Partial<Chat>): Promise<Chat> {
        const chat = new this.chatModel(chatData);
        return chat.save();
    }

    async findUserChats(userId: string): Promise<ChatDocument[]> {
        return this.chatModel
            .find({
                participants: new Types.ObjectId(userId),
                isActive: true,
            })
            .populate('participants', 'username email avatar')
            .populate('createdBy', 'username email avatar')
            .sort({ updatedAt: -1 });
    }

    async findChatById(chatId: string): Promise<Chat | ChatDocument> {
        console.log('Finding chat by ID:', chatId);
        const chat = await this.chatModel
            .findById(chatId)
            .populate('participants', 'username email avatar')
            .populate('createdBy', 'username email avatar');

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }
        return chat;
    }

    async addParticipant(chatId: string, userId: string, adminId: string): Promise<Chat> {
        const chat = await this.findChatById(chatId) as ChatDocument;

        // Check if user is admin for group chats
        if (chat.type === ChatType.GROUP && chat.admin?.toString() !== adminId) {
            throw new ForbiddenException('Only admin can add participants');
        }

        if (!chat.participants.includes(new Types.ObjectId(userId))) {
            chat.participants.push(new Types.ObjectId(userId));
            await chat.save();
        }

        return this.findChatById(chatId);
    }

    async removeParticipant(chatId: string, userId: string, adminId: string): Promise<Chat> {
        const chat = await this.findChatById(chatId) as ChatDocument;

        if (chat.type === ChatType.GROUP && chat.admin?.toString() !== adminId) {
            throw new ForbiddenException('Only admin can remove participants');
        }

        chat.participants = chat.participants.filter(
            participant => participant.toString() !== userId,
        );
        await chat.save();

        return this.findChatById(chatId);
    }

    async createPrivateChat(user1Id: string, user2Id: string): Promise<Chat> {
        // Check if private chat already exists
        const existingChat = await this.chatModel.findOne({
            type: ChatType.PRIVATE,
            participants: {
                $all: [
                    new Types.ObjectId(user1Id),
                    new Types.ObjectId(user2Id),
                ],
            },
        });

        if (existingChat) {
            return existingChat;
        }

        return this.createChat({
            type: ChatType.PRIVATE,
            participants: [
                new Types.ObjectId(user1Id),
                new Types.ObjectId(user2Id),
            ],
            createdBy: new Types.ObjectId(user1Id),
        });
    }
}