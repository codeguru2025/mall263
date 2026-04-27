import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { StallsModule } from './modules/stalls/stalls.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { POSModule } from './modules/pos/pos.module';
import { DemandsModule } from './modules/demands/demands.module';
import { SearchModule } from './modules/search/search.module';
import { AgentsModule } from './modules/agents/agents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { TrustModule } from './modules/trust/trust.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthModule } from './modules/health/health.module';
import { UploadModule } from './modules/upload/upload.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ChatModule } from './modules/chat/chat.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ServicesModule } from './modules/services/services.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SupportModule } from './modules/support/support.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { RunsModule } from './modules/runs/runs.module';
import { CodModule } from './modules/cod/cod.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CitiesModule } from './modules/cities/cities.module';
import { MallsModule } from './modules/malls/malls.module';
import { VirtualWalkModule } from './modules/virtual-walk/virtual-walk.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { DriverDocumentsModule } from './modules/driver-documents/driver-documents.module';
import { PickupPointsModule } from './modules/pickup-points/pickup-points.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    // Throttler uses Redis/Valkey so all API instances share counters
    // (memory storage would let an attacker bypass limits by spraying IPs
    // across instances). Falls back to in-memory if Redis is unreachable.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          // Broad baseline — 120 req/min per IP (keeps crawlers/scrapers from hammering)
          { name: 'global', ttl: 60_000, limit: 120 },
          // Burst allowance — up to 20 req/sec to handle legitimate mobile burst on app open
          { name: 'burst', ttl: 1_000, limit: 20 },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    AuthModule,
    UsersModule,
    MerchantsModule,
    StallsModule,
    ProductsModule,
    InventoryModule,
    WalletModule,
    POSModule,
    DemandsModule,
    SearchModule,
    AgentsModule,
    NotificationsModule,
    AdminModule,
    TrustModule,
    AuditModule,
    ReportsModule,
    HealthModule,
    UploadModule,
    PaymentsModule,
    ChatModule,
    SubscriptionsModule,
    ServicesModule,
    ExpensesModule,
    SupportModule,
    DeliveryModule,
    DriversModule,
    RunsModule,
    CodModule,
    DisputesModule,
    ReviewsModule,
    AddressesModule,
    CitiesModule,
    MallsModule,
    VirtualWalkModule,
    DiscountsModule,
    DriverDocumentsModule,
    PickupPointsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
