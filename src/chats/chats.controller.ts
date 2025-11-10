// src/chats/chats.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,

    Req,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { AuthGuard } from '@nestjs/passport';
import { Types } from 'mongoose';
import type { Request } from 'express';

export type ChatRequest = Request & { user: { _id: string } };
@UseGuards(AuthGuard('jwt'))
@Controller('chats')
export class ChatsController {
    constructor(private readonly chatsService: ChatsService) { }

    @Post()
    create(@Body() createChatDto: CreateChatDto, @Req() req: ChatRequest) {
        return this.chatsService.createChat({
            ...createChatDto,
            createdBy: new Types.ObjectId(req.user?._id),
            participants: createChatDto.participants.map((participant) => new Types.ObjectId(participant)),
        });
    }

    // @Get()
    // findAll(@Req() req) {
    //     return this.chatsService.findUserChats(req.user._id);
    // }

    // @Get(':id')
    // findOne(@Param('id') id: string) {
    //     return this.chatsService.findChatById(id);
    // }

    // @Post('private/:userId')
    // createPrivateChat(@Param('userId') userId: string, @Request() req) {
    //     return this.chatsService.createPrivateChat(req.user._id, userId);
    // }

    // @Post(':id/participants')
    // addParticipant(
    //     @Param('id') id: string,
    //     @Body('userId') userId: string,
    //     @Request() req,
    // ) {
    //     return this.chatsService.addParticipant(id, userId, req.user._id);
    // }

    // @Delete(':id/participants/:userId')
    // removeParticipant(
    //     @Param('id') id: string,
    //     @Param('userId') userId: string,
    //     @Request() req,
    // ) {
    //     return this.chatsService.removeParticipant(id, userId, req.user._id);
    // }
}