import { NextRequest } from 'next/server';
import { GET as getDispute } from '../route';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  const url = new URL(req.url);
  url.searchParams.set('format', 'pdf');
  const modifiedReq = new NextRequest(url.toString(), {
    headers: req.headers,
    method: 'GET',
  });
  return getDispute(modifiedReq, context);
}
