import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, VerifyEmailRequestDto, VerifyEmailConfirmDto, ForgotPasswordDto, ResetPasswordDto, CompleteRegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete registration after email verification' })
  async completeRegistration(@Body() dto: CompleteRegisterDto) {
    return this.authService.completeRegistration(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-email/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email verification code' })
  async verifyEmailRequest(@Body() dto: VerifyEmailRequestDto) {
    return this.authService.verifyEmailRequest(dto);
  }

  @Post('verify-email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email verification' })
  async verifyEmailConfirm(@Body() dto: VerifyEmailConfirmDto) {
    return this.authService.verifyEmailConfirm(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session' })
  async logout(@Req() req: any) {
    return this.authService.logout(BigInt(req.user.sub));
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout all sessions' })
  async logoutAll(@Req() req: any) {
    return this.authService.logoutAll(BigInt(req.user.sub));
  }
}
