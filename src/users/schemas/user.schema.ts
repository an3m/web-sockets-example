import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Exclude } from 'class-transformer';
import { HydratedDocument, } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserModel = User & { _id: any };

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true })
    email: string;

    @Exclude()
    @Prop({ required: true })
    password: string;

    @Prop({ required: true })
    username: string;

    @Prop()
    avatar?: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    lastSeen: Date;


    constructor(partial: Partial<User>) {
        Object.assign(this, partial);
    }
}

export const UserSchema = SchemaFactory.createForClass(User);