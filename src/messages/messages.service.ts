// src/messages/messages.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument, } from './schemas/message.schema';
import { ChatsService } from '../chats/chats.service';

@Injectable()
export class MessagesService {
    constructor(
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        private chatsService: ChatsService,
    ) { }

    async createMessage(messageData: Partial<Message>): Promise<Message> {
        const message = new this.messageModel(messageData);
        const savedMessage = await message.save();

        // Populate sender information
        const updatedMessage = await this.messageModel
            .findById(savedMessage._id)
            .populate('senderId', 'username email avatar');

        if (!updatedMessage) {
            throw new NotFoundException('Message not found after creation');
        }
        return updatedMessage;
    }

    async getChatMessages(chatId: string, page: number = 1, limit: number = 50): Promise<{
        messages: Message[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            this.messageModel
                .find({ chatId: new Types.ObjectId(chatId), isDeleted: false })
                .populate('senderId', 'username email avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.messageModel.countDocuments({
                chatId: new Types.ObjectId(chatId),
                isDeleted: false
            }),
        ]);

        return {
            messages: messages.reverse(), // Return in chronological order
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markAsRead(messageId: string, userId: string): Promise<Message> {
        const message = await this.messageModel.findById(messageId);
        if (!message) {
            throw new NotFoundException('Message not found');
        }

        const userObjectId = new Types.ObjectId(userId);
        if (!message.readBy.includes(userObjectId)) {
            message.readBy.push(userObjectId);
            await message.save();
        }

        const updatedMessage = await this.messageModel
            .findById(messageId)
            .populate('senderId', 'username email avatar');

        if (!updatedMessage) {
            throw new NotFoundException('Message not found');
        }

        return updatedMessage;
    }

    async editMessage(messageId: string, content: string, userId: string): Promise<Message | null> {
        const message = await this.messageModel.findOne({
            _id: messageId,
            senderId: new Types.ObjectId(userId),
        });

        if (!message) {
            throw new NotFoundException('Message not found or access denied');
        }

        message.content = content;
        message.isEdited = true;
        await message.save();

        return this.messageModel
            .findById(messageId)
            .populate('senderId', 'username email avatar');
    }

    async deleteMessage(messageId: string, userId: string): Promise<Message | null> {
        const message = await this.messageModel.findOne({
            _id: messageId,
            senderId: new Types.ObjectId(userId),
        });

        if (!message) {
            throw new NotFoundException('Message not found or access denied');
        }

        message.isDeleted = true;
        await message.save();

        return this.messageModel
            .findById(messageId)
            .populate('senderId', 'username email avatar');
    }
}