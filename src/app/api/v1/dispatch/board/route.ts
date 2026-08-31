import { NextRequest, NextResponse } from 'next/server';
import { DispatchBoardEngine } from '../../../../../lib/dispatch/dispatch-board-engine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';

    const board = await DispatchBoardEngine.getBoardState(tenantId);

    return NextResponse.json({
      success: true,
      board,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
