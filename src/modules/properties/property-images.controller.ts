import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { PropertyImagesService } from './property-images.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'properties');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const imageFileFilter = (_req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

@ApiTags('Property Images')
@Controller('properties')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PropertyImagesController {
  constructor(private readonly propertyImagesService: PropertyImagesService) {}

  @Post(':propertyId/images')
  @ApiOperation({ summary: 'Upload images for a property' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 20, {
      storage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadImages(
    @Param('propertyId') propertyId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    if (!files || files.length === 0) {
      return { success: false, error: 'No files uploaded' };
    }

    const uploadedImages = await this.propertyImagesService.uploadImages(
      propertyId,
      user,
      files,
    );

    return {
      success: true,
      images: uploadedImages,
      message: `${uploadedImages.length} image(s) uploaded successfully`,
    };
  }

  @Get(':propertyId/images')
  @ApiOperation({ summary: 'Get all images for a property' })
  async getPropertyImages(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: any,
  ) {
    return this.propertyImagesService.getPropertyImages(propertyId, user);
  }

  @Get(':propertyId/images/primary')
  @ApiOperation({ summary: 'Get primary image for a property' })
  async getPrimaryImage(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const images = await this.propertyImagesService.getPropertyImages(propertyId, user);
    const primaryImage = images.find((img: any) => img.isPrimary) || images[0];

    if (!primaryImage) {
      return res.status(404).json({ error: 'No images found' });
    }

    if (fs.existsSync(primaryImage.path)) {
      res.sendFile(path.resolve(primaryImage.path));
    } else {
      res.status(404).json({ error: 'Image file not found' });
    }
  }

  @Put(':propertyId/images/:imageId/primary')
  @ApiOperation({ summary: 'Set an image as primary' })
  async setPrimaryImage(
    @Param('propertyId') propertyId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: any,
  ) {
    const updatedImage = await this.propertyImagesService.setPrimaryImage(
      propertyId,
      imageId,
      user,
    );

    return {
      success: true,
      image: updatedImage,
      message: 'Primary image updated successfully',
    };
  }

  @Delete(':propertyId/images/:imageId')
  @ApiOperation({ summary: 'Delete an image' })
  async deleteImage(
    @Param('propertyId') propertyId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: any,
  ) {
    await this.propertyImagesService.deleteImage(propertyId, imageId, user);

    return {
      success: true,
      message: 'Image deleted successfully',
    };
  }
}
