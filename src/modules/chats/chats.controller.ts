import { Controller, Get, Post, Delete, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatsService } from './chats.service';

@ApiTags('Chats')
@Controller('chats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all chats for the user' })
  async getChats(@Req() req: any) {
    const userId = req.user.sub;
    return this.chatsService.getChats(userId);
  }

  @Get('available-users')
  @ApiOperation({ summary: 'Get available users to chat with' })
  async getAvailableUsers(@Req() req: any) {
    const userId = req.user.sub;
    const role = req.user.role;
    const agencyId = req.user.agencyId;
    return this.chatsService.getAvailableUsers(userId, role, agencyId);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get messages for a chat' })
  async getMessages(@Param('chatId') chatId: string, @Req() req: any) {
    const userId = req.user.sub;
    return this.chatsService.getMessages(chatId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new chat' })
  async createChat(@Body() body: { participantId: string }, @Req() req: any) {
    const userId = req.user.sub;
    return this.chatsService.createChat(userId, body.participantId);
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send a message in a chat' })
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ) {
    const userId = req.user.sub;
    return this.chatsService.sendMessage(chatId, userId, body.content);
  }

  @Delete(':chatId')
  @ApiOperation({ summary: 'Delete a chat' })
  async deleteChat(@Param('chatId') chatId: string, @Req() req: any) {
    const userId = req.user.sub;
    await this.chatsService.deleteChat(chatId, userId);
    return { message: 'Chat deleted successfully' };
  }

  @Patch(':chatId/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  async markAsRead(@Param('chatId') chatId: string, @Req() req: any) {
    const userId = req.user.sub;
    await this.chatsService.markAsRead(chatId, userId);
    return { message: 'Messages marked as read' };
  }
}
