import localforage from 'localforage';

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
      
      return true;
    } catch (error) {
      console.error('Error deleting user data:', error);
      return false;
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
}
