import { IsEnum, IsString, IsOptional, IsArray } from 'class-validator';
import { ChatType } from '../schemas/chat.schema';

export class CreateChatDto {
  @IsEnum(ChatType)
  type: ChatType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  participants: string[];

  @IsOptional()
  @IsString()
  avatar?: string;
}