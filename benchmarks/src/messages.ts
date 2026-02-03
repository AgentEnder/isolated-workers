/**
 * Shared message definitions for benchmarks
 */

import { DefineMessages } from 'isolated-workers';

/**
 * Benchmark message types
 */
export type BenchmarkMessages = DefineMessages<{
  /**
   * Simple ping-pong for latency testing
   */
  ping: {
    payload: { timestamp: number };
    result: { timestamp: number; workerTimestamp: number };
  };

  /**
   * Echo back data of various sizes for throughput testing
   */
  echo: {
    payload: { data: string };
    result: { data: string };
  };

  /**
   * Compute-bound task for CPU benchmarking
   */
  compute: {
    payload: { iterations: number };
    result: { result: number; duration: number };
  };
}>;
