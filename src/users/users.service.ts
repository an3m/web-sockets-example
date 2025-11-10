import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

    async findById(id: string): Promise<User> {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email });
    }

    async updateUser(id: string, updateData: Partial<User>): Promise<User> {
        const user = await this.userModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true },
        );
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async searchUsers(query: string): Promise<User[]> {
        return this.userModel.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ],
            isActive: true,
        });
    }
}