import { describe, it, expect } from 'vitest';
import { POST as StreamPost } from '../src/app/api/v1/quotes/stream/route';
import { NextRequest } from 'next/server';
import { CarrierCircuitBreaker } from '../src/lib/resilience/circuit-breaker';

describe('Phase 2.8 & 2.9: Async Streaming Rating API (SSE) & Parallel Timeout Resilience', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  it('streams progressive carrier quotes, volume LTL, and split optimization via Server-Sent Events', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/quotes/stream', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        originZip: '90001',
        originCity: 'Los Angeles',
        originState: 'CA',
        destZip: '60601',
        destCity: 'Chicago',
        destState: 'IL',
        items: [
          {
            lengthIn: 48,
            widthIn: 40,
            heightIn: 48,
            weightLbs: 1200,
            quantity: 4,
            nmfcClass: '70',
          },
          {
            lengthIn: 48,
            widthIn: 40,
            heightIn: 60,
            weightLbs: 800,
            quantity: 3,
            nmfcClass: '85',
          },
        ],
        accessorials: ['LIFTGATE_DELIVERY'],
      }),
    });

    const res = await StreamPost(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let streamOutput = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      streamOutput += decoder.decode(value, { stream: true });
    }

    expect(streamOutput).toContain('event: VOLUME_LTL');
    expect(streamOutput).toContain('event: QUOTE_RECEIVED');
    expect(streamOutput).toContain('event: SPLIT_OPTIMIZATION');
    expect(streamOutput).toContain('event: COMPLETE');
  });

  it('guarantees slow carrier timeout (3,500ms threshold) does not block fast carrier execution', async () => {
    const breaker = new CarrierCircuitBreaker('SLOW_CARRIER', { timeoutMs: 50 }); // 50ms test threshold

    const fastCarrier = async () => {
      return { status: 'FAST_SUCCESS', cost: 400 };
    };

    const slowCarrier = async () => {
      await new Promise((r) => setTimeout(r, 200));
      return { status: 'SLOW_SUCCESS', cost: 350 };
    };

    const [fastResult, slowResult] = await Promise.allSettled([
      breaker.execute(fastCarrier),
      breaker.execute(slowCarrier),
    ]);

    expect(fastResult.status).toBe('fulfilled');
    expect(slowResult.status).toBe('rejected');
  });
});
