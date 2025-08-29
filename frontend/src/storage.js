import localforage from 'localforage';
import { buildUserDatasetPointer } from './pointer-utils.js';

/**
 * Local storage management for user data
 */
export class StorageManager {
  constructor() {
    this.store = localforage.createInstance({
      name: 'TETOffersApp',
      storeName: 'userData',
      description: 'User uploaded internet offers data'
    });
  this.pointerKey = 'userPointerIndex';
    // Separate store for region (TET) data caching
    this.regionStore = localforage.createInstance({
      name: 'TETOffersApp',
      storeName: 'regionData',
      description: 'Cached TET region datasets'
    });
    this.regionPointerKey = 'regionPointerCache'; // latest pointer.json content
  }

  /**
   * Save user data to local storage
   */
  async saveUserData(data, filename, name) {
    try {
      const userData = {
        data,
        filename,
        name: name || filename,
        uploadDate: new Date().toISOString(),
        id: Date.now().toString()
      };
      
      await this.store.setItem(`userData_${userData.id}`, userData);
      
      // Also save to index for easy retrieval
      const index = await this.getUserDataIndex();
      index.push({
        id: userData.id,
        filename,
        name: userData.name,
        uploadDate: userData.uploadDate,
        recordCount: data.length
      });
      
      await this.store.setItem('userDataIndex', index);

  // Update user pointer index
  const pointerEntry = buildUserDatasetPointer(userData.data, userData.name);
  pointerEntry.id = userData.id;
  pointerEntry.filename = filename;
  const pointerIndex = await this.getUserPointerIndex();
  pointerIndex.push(pointerEntry);
  await this.store.setItem(this.pointerKey, pointerIndex);
      
      return userData.id;
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  }

  /**
   * Get all user data entries
   */
  async getAllUserData() {
    try {
      const index = await this.getUserDataIndex();
      const userData = [];
      
      for (const entry of index) {
        const data = await this.store.getItem(`userData_${entry.id}`);
        if (data) {
          userData.push(data);
        }
      }
      
      return userData;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return [];
    }
  }

  /**
   * Get user data index
   */
  async getUserDataIndex() {
    try {
      return (await this.store.getItem('userDataIndex')) || [];
    } catch (error) {
      console.error('Error getting user data index:', error);
      return [];
    }
  }

  /**
   * Delete user data by ID
   */
  async deleteUserData(id) {
    try {
      await this.store.removeItem(`userData_${id}`);
      
      const index = await this.getUserDataIndex();
      const updatedIndex = index.filter(entry => entry.id !== id);
      await this.store.setItem('userDataIndex', updatedIndex);

  // Update pointer index
  const pointerIndex = await this.getUserPointerIndex();
  const updatedPointer = pointerIndex.filter(p => p.id !== id);
  await this.store.setItem(this.pointerKey, updatedPointer);
      
      return true;
    } catch (error) {
      console.error('Error deleting user data:', error);
      return false;
    }
  }

  /** Retrieve a single user dataset by id (returns full stored object with data array) */
  async getUserDataset(id) {
    try {
      if (!id) return null;
      return await this.store.getItem(`userData_${id}`);
    } catch (e) {
      console.error('Error getting user dataset', id, e);
      return null;
    }
  }

  /**
   * Clear all user data
   */
  async clearAllUserData() {
    try {
      await this.store.clear();
      return true;
    } catch (error) {
      console.error('Error clearing user data:', error);
      return false;
    }
  }

  /** Get user pointer index */
  async getUserPointerIndex() {
    try {
      return (await this.store.getItem(this.pointerKey)) || [];
    } catch (e) {
      console.error('Error reading user pointer index', e);
      return [];
    }
  }

  // -------- Region (TET) caching API --------

  async saveRegionPointer(pointerArray) {
    try {
      await this.regionStore.setItem(this.regionPointerKey, pointerArray || []);
    } catch (e) {
      console.error('Failed saving region pointer', e);
    }
  }

  async getRegionPointer() {
    try {
      return (await this.regionStore.getItem(this.regionPointerKey)) || [];
    } catch (e) {
      console.error('Failed reading region pointer', e);
      return [];
    }
  }

  async getCachedRegionNames() {
    try {
      const keys = await this.regionStore.keys();
      return keys.filter(k => k.startsWith('region_')).map(k => k.replace('region_',''));
    } catch { return []; }
  }

  async getRegionDataset(name) {
    try { return await this.regionStore.getItem(`region_${name}`); } catch { return null; }
  }

  async saveRegionDataset(name, records, updatedAt) {
    try {
      const payload = { updatedAt: updatedAt || new Date().toISOString(), records };
      await this.regionStore.setItem(`region_${name}`, payload);
      return payload;
    } catch (e) { console.error('Failed saving region dataset', name, e); return null; }
  }

  /** Ensure region dataset fresh: returns records (from cache or null if needs fetch) */
  async getOrInvalidateRegion(name, expectedUpdatedAt) {
    const existing = await this.getRegionDataset(name);
    if (!existing) return null; // not cached
    if (!expectedUpdatedAt) return existing.records; // no reference timestamp -> accept
    if (existing.updatedAt === expectedUpdatedAt) return existing.records;
    // timestamp mismatch -> invalidate
    await this.regionStore.removeItem(`region_${name}`);
    return null;
  }
}
