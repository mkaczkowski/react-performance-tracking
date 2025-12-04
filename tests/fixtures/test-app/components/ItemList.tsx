import { Profiler, useState } from 'react';

import { usePerformance } from '@lib/react';

/**
 * List component that renders multiple items for more complex profiling
 */
export const ItemList = () => {
  const [items, setItems] = useState<string[]>(['Item 1', 'Item 2', 'Item 3']);
  const performanceContext = usePerformance();

  if (!performanceContext) {
    return null;
  }

  const { onProfilerRender } = performanceContext;

  const addItem = () => {
    setItems((prev) => [...prev, `Item ${prev.length + 1}`]);
  };

  return (
    <Profiler id="item-list" onRender={onProfilerRender}>
      <div>
        <h2>Items</h2>
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
        <button onClick={addItem} data-testid="add-item-btn">
          Add Item
        </button>
      </div>
    </Profiler>
  );
};
