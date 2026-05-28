// src/repositories/BaseRepository.ts
import { scheduleCloudBackup } from '../services/cloudSync';

export class BaseRepository<T extends { id: string }> {
  protected storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  protected load(): T[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Error loading data from ${this.storageKey}`, e);
      return [];
    }
  }

  protected save(data: T[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      scheduleCloudBackup();
    } catch (e) {
      console.error(`Error saving data to ${this.storageKey}`, e);
    }
  }

  public getAll(): T[] {
    return this.load();
  }

  public getById(id: string): T | undefined {
    return this.load().find(item => item.id === id);
  }

  public create(item: T): T {
    const items = this.load();
    items.push(item);
    this.save(items);
    return item;
  }

  public update(id: string, updates: Partial<T>): T | null {
    const items = this.load();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;

    items[index] = { ...items[index], ...updates };
    this.save(items);
    return items[index];
  }

  public upsert(item: T): T {
    const items = this.load();
    const index = items.findIndex(i => i.id === item.id);
    if (index === -1) {
      items.push(item);
    } else {
      items[index] = item;
    }
    this.save(items);
    return item;
  }

  public delete(id: string): boolean {
    const items = this.load();
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;
    this.save(filtered);
    return true;
  }

  public clear(): void {
    this.save([]);
  }
}
