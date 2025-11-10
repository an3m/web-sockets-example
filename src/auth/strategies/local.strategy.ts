import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from 'src/users/schemas/user.schema';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super(
            {
                usernameField: 'email',
                passwordField: 'password'
            }
        ); // Use 'email' instead of 'username' if needed
    }

    async validate(email: string, password: string): Promise<User> {

        const user = await this.authService.validateUser(email, password);
        if (!user) {
            throw new UnauthorizedException();
        }
        console.log('LocalStrategy validated user:', email, user.email);
        user.password = password; // Attach the raw password for further use
        console.log('LocalStrategy validated user:', password, email);
        return user;
    }
}