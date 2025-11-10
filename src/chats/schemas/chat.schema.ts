import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

export enum ChatType {
    PRIVATE = 'private',
    GROUP = 'group',
}

@Schema({ timestamps: true })
export class Chat {
    @Prop({ required: true, enum: ChatType })
    type: ChatType;

    @Prop()
    name?: string;

    @Prop()
    description?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;

    // List of participants' user IDs
    // For private chats, this will contain exactly two user IDs
    @Prop([{ type: Types.ObjectId, ref: 'User' }])
    participants: Types.ObjectId[];

    @Prop({ type: Types.ObjectId, ref: 'User' })
    admin?: Types.ObjectId;

    @Prop()
    avatar?: string;

    @Prop({ default: true })
    isActive: boolean;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);