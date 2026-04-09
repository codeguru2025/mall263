import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DemandStatus, DemandUrgency, Prisma } from '@prisma/client';

export interface DemandRankingParams {
  categoryId?: string;
  mallId?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  page?: number;
  limit?: number;
}

export interface DemandWithScore {
  id: string;
  title: string;
  description: string | null;
  maxBudget: Prisma.Decimal;
  minBudget: Prisma.Decimal | null;
  currency: string;
  urgency: DemandUrgency;
  status: DemandStatus;
  expiresAt: Date;
  createdAt: Date;
  buyerId: string;
  categoryId: string | null;
  mallId: string | null;
  score: number;
  rank: number;
  timeRemainingHours: number;
  offerCount: number;
  buyer: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
    trustScore: {
      overallScore: Prisma.Decimal | null;
    } | null;
  };
  distanceKm?: number;
}

@Injectable()
export class DemandRankingService {
  constructor(private prisma: PrismaService) {}

  // Urgency weights for scoring
  private readonly urgencyWeights: Record<DemandUrgency, number> = {
    URGENT: 100,
    HIGH: 75,
    MEDIUM: 50,
    LOW: 25,
  };

  // Time decay factors (hours)
  private readonly timeThresholds = {
    critical: 1,    // < 1 hour
    urgent: 24,     // < 24 hours
    high: 72,       // < 3 days
    medium: 168,    // < 1 week
  };

  /**
   * Calculate demand score based on multiple factors:
   * - Urgency weight (25-100 points)
   * - Time decay (0-50 points bonus for near-expiry)
   * - Trust score boost (0-20 points)
   * - Budget attractiveness (0-15 points)
   * - Offer competition factor (0-10 points)
   * - Freshness (0-10 points)
   */
  calculateDemandScore(demand: any, now: Date = new Date()): number {
    let score = 0;

    // 1. Base urgency weight (25-100 points)
    const urgencyValue = demand.urgency as DemandUrgency;
    const urgencyWeight = this.urgencyWeights[urgencyValue] || 25;
    score += urgencyWeight;

    // 2. Time decay bonus (0-50 points)
    const hoursRemaining = Math.max(0, (demand.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    let timeBonus = 0;
    
    if (hoursRemaining <= this.timeThresholds.critical) {
      // Critical: less than 1 hour - maximum bonus
      timeBonus = 50 * (1 - hoursRemaining / this.timeThresholds.critical);
    } else if (hoursRemaining <= this.timeThresholds.urgent) {
      // Urgent: less than 24 hours
      timeBonus = 35 * (1 - hoursRemaining / this.timeThresholds.urgent);
    } else if (hoursRemaining <= this.timeThresholds.high) {
      // High: less than 3 days
      timeBonus = 20 * (1 - hoursRemaining / this.timeThresholds.high);
    } else if (hoursRemaining <= this.timeThresholds.medium) {
      // Medium: less than 1 week
      timeBonus = 10 * (1 - hoursRemaining / this.timeThresholds.medium);
    }
    score += timeBonus;

    // 3. Trust score boost (0-20 points)
    const trustScore = demand.buyer?.trustScore?.overallScore 
      ? parseFloat(demand.buyer.trustScore.overallScore.toString()) 
      : 50;
    const trustBoost = (trustScore / 100) * 20;
    score += trustBoost;

    // 4. Budget attractiveness (0-15 points)
    // Higher budgets get slightly more visibility
    const maxBudget = parseFloat(demand.maxBudget?.toString() || '0');
    if (maxBudget > 0) {
      // Logarithmic scale to prevent super high budgets from dominating
      const budgetScore = Math.min(15, Math.log10(maxBudget + 1) * 3);
      score += budgetScore;
    }

    // 5. Offer competition factor (0-10 points)
    // Fewer offers = more opportunity for sellers
    const offerCount = demand.offers?.length || 0;
    const competitionScore = Math.max(0, 10 - offerCount * 2);
    score += competitionScore;

    // 6. Freshness bonus (0-10 points)
    // Newer demands get a small boost
    const hoursSinceCreated = (now.getTime() - demand.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated <= 24) {
      score += 10 * (1 - hoursSinceCreated / 24);
    }

    // 7. Distance penalty (if location provided)
    if (demand.distanceKm !== undefined) {
      // Small penalty for far away demands
      const distancePenalty = Math.min(20, demand.distanceKm * 0.5);
      score -= distancePenalty;
    }

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get ranked demands for sellers
   * Sorts by computed score with multiple ranking factors
   */
  async getRankedDemands(params: DemandRankingParams): Promise<{
    data: DemandWithScore[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      categoryId,
      mallId,
      latitude,
      longitude,
      maxDistanceKm = 50,
      page = 1,
      limit = 20,
    } = params;

    const now = new Date();
    const skip = (page - 1) * limit;

    // Build base where clause
    const where: Prisma.BuyerDemandWhereInput = {
      status: DemandStatus.OPEN,
      expiresAt: { gt: now },
    };

    if (categoryId) where.categoryId = categoryId;
    if (mallId) where.mallId = mallId;

    // Get all matching demands with relations
    const demands = await this.prisma.buyerDemand.findMany({
      where,
      include: {
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            trustScore: {
              select: { overallScore: true },
            },
          },
        },
        offers: {
          where: { status: { in: ['PENDING', 'ACCEPTED'] } },
          select: { id: true, status: true },
        },
        _count: {
          select: { offers: true },
        },
      },
    });

    // Calculate scores and add distance if location provided
    const demandsWithScores = demands.map((demand) => {
      let distanceKm: number | undefined;

      // Calculate distance if coordinates provided
      if (latitude !== undefined && longitude !== undefined) {
        const mallLat = (demand as any).mall?.latitude;
        const mallLng = (demand as any).mall?.longitude;
        
        if (mallLat !== null && mallLng !== null) {
          distanceKm = this.haversine(latitude, longitude, mallLat, mallLng);
        }
      }

      const score = this.calculateDemandScore({ ...demand, distanceKm }, now);
      const hoursRemaining = (demand.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      return {
        ...demand,
        score,
        timeRemainingHours: Math.round(hoursRemaining * 100) / 100,
        offerCount: (demand as any)._count.offers,
        distanceKm,
      };
    });

    // Filter by distance if specified
    let filteredDemands = demandsWithScores;
    if (latitude !== undefined && longitude !== undefined) {
      filteredDemands = demandsWithScores.filter(
        (d) => d.distanceKm === undefined || d.distanceKm <= maxDistanceKm
      );
    }

    // Sort by score descending
    filteredDemands.sort((a, b) => b.score - a.score);

    // Add rank
    const rankedDemands = filteredDemands.map((d, i) => ({
      ...d,
      rank: i + 1,
    }));

    // Paginate
    const total = rankedDemands.length;
    const paginatedData = rankedDemands.slice(skip, skip + limit);

    return {
      data: paginatedData as DemandWithScore[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get trending demands (high score + recent activity)
   */
  async getTrendingDemands(limit = 10): Promise<DemandWithScore[]> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const demands = await this.prisma.buyerDemand.findMany({
      where: {
        status: DemandStatus.OPEN,
        expiresAt: { gt: now },
        createdAt: { gte: yesterday },
      },
      include: {
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            trustScore: {
              select: { overallScore: true },
            },
          },
        },
        offers: {
          where: { createdAt: { gte: yesterday } },
          select: { id: true },
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Get more than needed for scoring
    });

    const scoredDemands = demands.map((demand) => {
      const score = this.calculateDemandScore(demand, now);
      const hoursRemaining = (demand.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      return {
        ...demand,
        score,
        timeRemainingHours: Math.round(hoursRemaining * 100) / 100,
        offerCount: (demand as any)._count.offers,
        rank: 0,
      };
    });

    scoredDemands.sort((a, b) => b.score - a.score);

    return scoredDemands.slice(0, limit).map((d, i) => ({ ...d, rank: i + 1 }));
  }

  /**
   * Get urgent demands (expiring soon)
   */
  async getUrgentDemands(limit = 10): Promise<DemandWithScore[]> {
    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const demands = await this.prisma.buyerDemand.findMany({
      where: {
        status: DemandStatus.OPEN,
        expiresAt: { gt: now, lte: sixHoursFromNow },
      },
      include: {
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            trustScore: {
              select: { overallScore: true },
            },
          },
        },
        offers: {
          select: { id: true },
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    return demands.map((demand, i) => {
      const score = this.calculateDemandScore(demand, now);
      const hoursRemaining = (demand.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      return {
        ...demand,
        score,
        timeRemainingHours: Math.round(hoursRemaining * 100) / 100,
        offerCount: (demand as any)._count.offers,
        rank: i + 1,
      };
    }) as DemandWithScore[];
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
