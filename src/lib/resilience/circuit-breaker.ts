export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // default: 3
  cooldownPeriodMs?: number; // default: 60,000ms (60 seconds)
  timeoutMs?: number;        // default: 3,500ms
}

export class CarrierCircuitBreaker {
  public readonly carrierCode: string;
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly timeoutMs: number;

  constructor(carrierCode: string, options?: CircuitBreakerOptions) {
    this.carrierCode = carrierCode;
    this.failureThreshold = options?.failureThreshold || 3;
    this.cooldownPeriodMs = options?.cooldownPeriodMs || 60_000; // 60s
    this.timeoutMs = options?.timeoutMs || 3500; // 3.5s timeout
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new Error(
        `CircuitBreaker [${this.carrierCode}]: Circuit is OPEN (3 consecutive timeouts). Carrier is currently in 60-second cooldown.`
      );
    }

    let timer: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`CircuitBreaker [${this.carrierCode}]: Operation timed out after ${this.timeoutMs}ms`));
        }, this.timeoutMs);
      });

      const result = await Promise.race([action(), timeoutPromise]);
      if (timer) clearTimeout(timer);

      // On successful execution in HALF_OPEN or CLOSED
      this.onSuccess();
      return result;
    } catch (error) {
      if (timer) clearTimeout(timer);
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    }
  }

  public forceReset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  public forceOpen(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }
}
