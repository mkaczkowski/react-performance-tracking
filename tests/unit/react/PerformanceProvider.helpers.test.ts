import { describe, expect, it } from 'vitest';

import {
  createPerformanceStore,
  updatePerformanceStore,
} from '@lib/react/PerformanceProvider.helpers';
import type { PerformanceSample } from '@lib/react/PerformanceProvider.types';

describe('PerformanceProvider.helpers', () => {
  describe('createPerformanceStore', () => {
    it('should create a store with initial values', () => {
      const samples: PerformanceSample[] = [];
      const store = createPerformanceStore(samples);

      expect(store.samples).toBe(samples);
      expect(store.totalActualDuration).toBe(0);
      expect(store.totalBaseDuration).toBe(0);
      expect(store.lastSample).toBeUndefined();
      expect(store.components).toEqual({});
      expect(typeof store.reset).toBe('function');
    });

    it('should reset store values when reset is called', () => {
      const samples: PerformanceSample[] = [
        {
          id: 'test',
          phase: 'mount',
          actualDuration: 10,
          baseDuration: 15,
          startTime: 0,
          commitTime: 10,
        },
      ];
      const store = createPerformanceStore(samples);

      // Manually set some values
      store.totalActualDuration = 100;
      store.totalBaseDuration = 150;
      store.lastSample = samples[0];
      store.components = {
        test: {
          totalActualDuration: 100,
          totalBaseDuration: 150,
          renderCount: 1,
          samples: samples,
        },
      };

      // Reset
      store.reset();

      expect(store.samples.length).toBe(0);
      expect(store.totalActualDuration).toBe(0);
      expect(store.totalBaseDuration).toBe(0);
      expect(store.lastSample).toBeUndefined();
      expect(store.components).toEqual({});
    });
  });

  describe('updatePerformanceStore', () => {
    it('should update store with new sample data', () => {
      const samples: PerformanceSample[] = [];
      const store = createPerformanceStore(samples);

      const sample: PerformanceSample = {
        id: 'test',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 15,
        startTime: 0,
        commitTime: 10,
      };

      samples.push(sample);

      updatePerformanceStore({
        store,
        samples,
        sample,
        actualDuration: 10,
        baseDuration: 15,
      });

      expect(store.samples).toBe(samples);
      expect(store.totalActualDuration).toBe(10);
      expect(store.totalBaseDuration).toBe(15);
      expect(store.lastSample).toBe(sample);
    });

    it('should accumulate durations across multiple updates', () => {
      const samples: PerformanceSample[] = [];
      const store = createPerformanceStore(samples);

      const sample1: PerformanceSample = {
        id: 'test',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 15,
        startTime: 0,
        commitTime: 10,
      };

      const sample2: PerformanceSample = {
        id: 'test',
        phase: 'update',
        actualDuration: 5,
        baseDuration: 8,
        startTime: 10,
        commitTime: 15,
      };

      samples.push(sample1);
      updatePerformanceStore({
        store,
        samples,
        sample: sample1,
        actualDuration: 10,
        baseDuration: 15,
      });

      samples.push(sample2);
      updatePerformanceStore({
        store,
        samples,
        sample: sample2,
        actualDuration: 5,
        baseDuration: 8,
      });

      expect(store.totalActualDuration).toBe(15);
      expect(store.totalBaseDuration).toBe(23);
      expect(store.lastSample).toBe(sample2);
    });

    it('should do nothing if store is null', () => {
      const samples: PerformanceSample[] = [];
      const sample: PerformanceSample = {
        id: 'test',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 15,
        startTime: 0,
        commitTime: 10,
      };

      // Should not throw
      expect(() => {
        updatePerformanceStore({
          store: null,
          samples,
          sample,
          actualDuration: 10,
          baseDuration: 15,
        });
      }).not.toThrow();
    });

    it('should create component metrics for new component', () => {
      const samples: PerformanceSample[] = [];
      const store = createPerformanceStore(samples);

      const sample: PerformanceSample = {
        id: 'my-component',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 15,
        startTime: 0,
        commitTime: 10,
      };

      samples.push(sample);
      updatePerformanceStore({
        store,
        samples,
        sample,
        actualDuration: 10,
        baseDuration: 15,
      });

      expect(store.components['my-component']).toBeDefined();
      expect(store.components['my-component'].totalActualDuration).toBe(10);
      expect(store.components['my-component'].totalBaseDuration).toBe(15);
      expect(store.components['my-component'].renderCount).toBe(1);
      expect(store.components['my-component'].samples).toHaveLength(1);
      expect(store.components['my-component'].samples[0]).toBe(sample);
    });

    it('should aggregate metrics for existing component', () => {
      const samples: PerformanceSample[] = [];
      const store = createPerformanceStore(samples);

      const sample1: PerformanceSample = {
        id: 'counter',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 15,
        startTime: 0,
        commitTime: 10,
      };

      const sample2: PerformanceSample = {
        id: 'counter',
        phase: 'update',
        actualDuration: 5,
        baseDuration: 8,
        startTime: 10,
        commitTime: 15,
      };

      samples.push(sample1);
      updatePerformanceStore({
        store,
        samples,
        sample: sample1,
        actualDuration: 10,
        baseDuration: 15,
      });

      samples.push(sample2);
      updatePerformanceStore({
        store,
        samples,
        sample: sample2,
        actualDuration: 5,
        baseDuration: 8,
      });

      expect(store.components['counter'].totalActualDuration).toBe(15);
      expect(store.components['counter'].totalBaseDuration).toBe(23);
      expect(store.components['counter'].renderCount).toBe(2);
      expect(store.components['counter'].samples).toHaveLength(2);
    });

    it('should track multiple components separately', () => {
      const samples: PerformanceSample[] = [];
      const store = createPerformanceStore(samples);

      const counterSample: PerformanceSample = {
        id: 'counter',
        phase: 'mount',
        actualDuration: 10,
        baseDuration: 15,
        startTime: 0,
        commitTime: 10,
      };

      const listSample: PerformanceSample = {
        id: 'item-list',
        phase: 'mount',
        actualDuration: 20,
        baseDuration: 25,
        startTime: 10,
        commitTime: 30,
      };

      const counterUpdate: PerformanceSample = {
        id: 'counter',
        phase: 'update',
        actualDuration: 5,
        baseDuration: 8,
        startTime: 30,
        commitTime: 35,
      };

      samples.push(counterSample);
      updatePerformanceStore({
        store,
        samples,
        sample: counterSample,
        actualDuration: 10,
        baseDuration: 15,
      });

      samples.push(listSample);
      updatePerformanceStore({
        store,
        samples,
        sample: listSample,
        actualDuration: 20,
        baseDuration: 25,
      });

      samples.push(counterUpdate);
      updatePerformanceStore({
        store,
        samples,
        sample: counterUpdate,
        actualDuration: 5,
        baseDuration: 8,
      });

      // Verify global totals
      expect(store.totalActualDuration).toBe(35);
      expect(store.totalBaseDuration).toBe(48);
      expect(store.samples).toHaveLength(3);

      // Verify counter component metrics
      expect(store.components['counter'].totalActualDuration).toBe(15);
      expect(store.components['counter'].totalBaseDuration).toBe(23);
      expect(store.components['counter'].renderCount).toBe(2);
      expect(store.components['counter'].samples).toHaveLength(2);

      // Verify item-list component metrics
      expect(store.components['item-list'].totalActualDuration).toBe(20);
      expect(store.components['item-list'].totalBaseDuration).toBe(25);
      expect(store.components['item-list'].renderCount).toBe(1);
      expect(store.components['item-list'].samples).toHaveLength(1);
    });
  });
});
