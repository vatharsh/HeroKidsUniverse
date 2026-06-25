import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { CreditPacksService } from './credits/credit-packs.service';
import { seedDefaultPacks } from './credits/credit-packs.seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:3001', 'https://heroversekids.com'] });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('HeroVerse Kids API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);

  try {
    await seedDefaultPacks(app.get(CreditPacksService));
  } catch (error) {
    console.error('Failed to seed default credit packs', error);
  }
}
bootstrap();
