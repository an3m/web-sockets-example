import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserModel } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, LoginResponse } from './interfaces';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userModel.findOne({ email, isActive: true });
        if (!user) return null;
        console.log(email, user?.email);
        const isPasswordValid = user ? await bcrypt.compare(password, user.password) : false;
        if (isPasswordValid) return user;
        return null;
    }

    async login(userData: LoginDto): Promise<LoginResponse> {

        const user = await this.usersService.findByEmail(userData.email);
        console.log('Login attempt for user:', userData.email);
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const id: string = String(user._id);

        const payload: JwtPayload = { sub: id, username: user.username };

        return {
            access_token: this.jwtService.sign(payload,

            ),
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
        return this.login({ email: user.email, password: userData.password });
    }

    async validateToken(payload: JwtPayload): Promise<UserModel> {

        const user = await this.userModel.findById(payload.sub);
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid token');
        }
        // console.log('Validated token for user:', String(user._id));
        return user;
    }
}