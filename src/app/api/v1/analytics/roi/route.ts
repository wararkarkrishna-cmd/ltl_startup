import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveRoiEngine } from '@/lib/analytics/executive-roi-engine';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    const periodDays = parseInt(req.nextUrl.searchParams.get('periodDays') || '30', 10);

    const metrics = await ExecutiveRoiEngine.calculateExecutiveRoi(tenantId, periodDays);

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate executive ROI metrics' },
      { status: 500 }
    );
  }
}
