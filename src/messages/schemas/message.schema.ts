import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Chat } from 'src/chats/schemas/chat.schema';
import { User } from 'src/users/schemas/user.schema';

export type MessageDocument = Message & Document;

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    FILE = 'file',
    SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class Message {
    @Prop({ type: Types.ObjectId, ref: Chat.name, required: true })
    chatId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true
    })
    senderId: Types.ObjectId;

    @Prop({ required: true, enum: MessageType })
    type: MessageType;

    @Prop()
    content: string;

    @Prop()
    fileUrl?: string;

    @Prop()
    fileName?: string;

    @Prop({ default: false })
    isEdited: boolean;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop([{ type: Types.ObjectId, ref: 'User' }])
    readBy: Types.ObjectId[];

    @Prop({ type: Object })
    metadata?: Record<string, any>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);