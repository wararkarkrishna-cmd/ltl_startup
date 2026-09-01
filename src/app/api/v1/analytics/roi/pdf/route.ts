import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveRoiEngine } from '@/lib/analytics/executive-roi-engine';
import { ExecutiveBoardReportGenerator } from '@/lib/documents/executive-board-report-generator';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    const periodDays = parseInt(req.nextUrl.searchParams.get('periodDays') || '30', 10);

    const metrics = await ExecutiveRoiEngine.calculateExecutiveRoi(tenantId, periodDays);
    const pdfBuffer = await ExecutiveBoardReportGenerator.renderBoardReportPdf(metrics);

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Apex_Executive_Board_ROI_Report_${periodDays}Days.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to render Executive Board Report PDF' },
      { status: 500 }
    );
  }
}
