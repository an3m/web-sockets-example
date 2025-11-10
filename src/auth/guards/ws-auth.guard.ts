// src/auth/guards/ws-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { UsersService } from '../../users/users.service';
import { Socket } from 'socket.io';
import { JwtPayload } from '../interfaces';
import { AuthenticatedSocket } from 'src/chats/chats.gateway';

@Injectable()
export class WsAuthGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client = context.switchToWs().getClient<AuthenticatedSocket>();

        try {
            const token = this.extractTokenFromClient(client);
            if (!token) {
                throw new WsException('Missing authentication token');
            }

            const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
            const user = await this.usersService.findById(payload.sub);

            if (!user) {
                throw new WsException('User not found');
            }

            // Attach user to client
            client.user = {
                ...user,
                _id: user._id.toString(),
            };

            return true;
        } catch (error) {
            console.error('WebSocket authentication error:', error);
            throw new WsException('Authentication failed');
        }
    }

    private extractTokenFromClient(client: Socket): string | null {
        // Check handshake auth
        const handshake = client.handshake;

        if (handshake?.auth?.token) {
            return handshake.auth.token as string;
        }

        // Check query parameters
        if (handshake?.query?.token) {
            return handshake.query.token as string;
        }

        // Check headers
        const authHeader = handshake?.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return null;
    }

    validate(payload: JwtPayload) {
        return this.usersService.findById(payload.sub);
    }
}