import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto, RegisterUserDto } from './dto/login.dto';
import { JwtPayload, LoginResponse } from './interfaces';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, password: string): Promise<UserDocument | null> {
        const user = await this.userModel.findOne({ email, isActive: true });
        if (user && await bcrypt.compare(password, user.password)) {
            return user;
        }
        return null;
    }

    async login(userData: LoginDto): Promise<LoginResponse> {
        const user = await this.validateUser(userData.email, userData.password);
        if (!user || !user.isActive || !user.id) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const id: string = String(user.id);

        const payload: JwtPayload = { sub: id, username: user.username };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: id,
                email: user.email,
                username: user.username,
                avatar: user.avatar,
            },
        };
    }

    async register(userData: CreateUserDto): Promise<LoginResponse> {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const user = new this.userModel({
            ...userData,
            password: hashedPassword,
        });

        await user.save();

        return this.login(user);
    }

    async validateToken(payload: JwtPayload): Promise<User> {

        const user = await this.userModel.findById(payload.sub);
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid token');

        }
        return user;

    }
}