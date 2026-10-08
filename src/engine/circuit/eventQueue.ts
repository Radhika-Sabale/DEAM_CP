/**
 * @file eventQueue.ts
 * Discrete-event binary min-heap priority queue for circuit simulation.
 *
 * Events are prioritized by scheduled simulation time (ascending).
 * Events with identical simulation timestamps are resolved strictly in FIFO
 * insertion order using an internal monotonic sequence counter.
 */

interface HeapEntry<T> {
  readonly time: number;
  readonly seq: number;
  readonly payload: T;
}

/**
 * Binary min-heap priority queue keyed by (time, seq).
 */
export class EventQueue<T> {
  private heap: HeapEntry<T>[] = [];
  private nextSeq = 0;

  /**
   * Pushes a new scheduled event onto the priority queue.
   *
   * @param time Non-negative integer simulation timestamp
   * @param payload Event data
   * @returns True if successfully enqueued, false if timestamp is invalid
   */
  public push(time: number, payload: T): boolean {
    if (
      typeof time !== 'number' ||
      !Number.isFinite(time) ||
      !Number.isInteger(time) ||
      time < 0
    ) {
      return false;
    }

    const entry: HeapEntry<T> = {
      time,
      seq: this.nextSeq++,
      payload,
    };

    this.heap.push(entry);
    this.siftUp(this.heap.length - 1);
    return true;
  }

  /**
   * Removes and returns the earliest scheduled event.
   *
   * @returns Earliest event entry, or undefined if empty
   */
  public pop(): { readonly time: number; readonly payload: T } | undefined {
    if (this.heap.length === 0) return undefined;

    const root = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.siftDown(0);
    }

    return root ? { time: root.time, payload: root.payload } : undefined;
  }

  /**
   * Inspects the earliest scheduled event without removing it.
   */
  public peek(): { readonly time: number; readonly payload: T } | undefined {
    const root = this.heap[0];
    return root ? { time: root.time, payload: root.payload } : undefined;
  }

  /**
   * Inspects the timestamp of the earliest scheduled event.
   *
   * @returns Earliest scheduled timestamp, or undefined if empty
   */
  public peekTime(): number | undefined {
    return this.heap[0]?.time;
  }

  /**
   * Returns the current number of pending events.
   */
  public size(): number {
    return this.heap.length;
  }

  /**
   * Checks whether the event queue is currently empty.
   */
  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Clears all pending events and resets the sequence counter.
   */
  public clear(): void {
    this.heap = [];
    this.nextSeq = 0;
  }

  /**
   * Pops and returns all events satisfying a predicate on the queue's head.
   *
   * @param predicate Callback returning true if top event should be popped
   * @returns Array of popped event records
   */
  public popWhile(
    predicate: (time: number, payload: T) => boolean
  ): { readonly time: number; readonly payload: T }[] {
    const popped: { readonly time: number; readonly payload: T }[] = [];
    while (this.heap.length > 0) {
      const root = this.heap[0];
      if (!root || !predicate(root.time, root.payload)) {
        break;
      }
      const item = this.pop();
      if (item) popped.push(item);
    }
    return popped;
  }

  /**
   * Sifts an element up the heap towards the root.
   */
  private siftUp(index: number): void {
    let cur = index;
    while (cur > 0) {
      const parent = (cur - 1) >> 1;
      const curEntry = this.heap[cur];
      const parentEntry = this.heap[parent];
      if (!curEntry || !parentEntry) break;

      if (this.compare(curEntry, parentEntry) < 0) {
        this.heap[cur] = parentEntry;
        this.heap[parent] = curEntry;
        cur = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Sifts an element down the heap towards the leaves.
   */
  private siftDown(index: number): void {
    let cur = index;
    const len = this.heap.length;

    while ((cur << 1) + 1 < len) {
      const left = (cur << 1) + 1;
      const right = left + 1;
      let smallest = cur;

      const smallestEntry = this.heap[smallest];
      const leftEntry = this.heap[left];
      const rightEntry = this.heap[right];

      if (
        left < len &&
        leftEntry &&
        smallestEntry &&
        this.compare(leftEntry, smallestEntry) < 0
      ) {
        smallest = left;
      }

      const curSmallestEntry = this.heap[smallest];
      if (
        right < len &&
        rightEntry &&
        curSmallestEntry &&
        this.compare(rightEntry, curSmallestEntry) < 0
      ) {
        smallest = right;
      }

      if (smallest !== cur) {
        const temp = this.heap[cur];
        const swapEntry = this.heap[smallest];
        if (temp && swapEntry) {
          this.heap[cur] = swapEntry;
          this.heap[smallest] = temp;
        }
        cur = smallest;
      } else {
        break;
      }
    }
  }

  /**
   * Compares two heap entries: primary key = time ascending, secondary key = seq ascending.
   */
  private compare(a: HeapEntry<T>, b: HeapEntry<T>): number {
    if (a.time !== b.time) {
      return a.time - b.time;
    }
    return a.seq - b.seq;
  }
}
