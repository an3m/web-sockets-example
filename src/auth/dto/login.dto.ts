import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength
} from "class-validator";

export class LoginDto {
  @IsString()
  @IsEmail()
  @MinLength(5)
  email: string;


  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;
}