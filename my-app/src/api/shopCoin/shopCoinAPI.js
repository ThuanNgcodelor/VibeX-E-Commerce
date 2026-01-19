import createApiInstance from '../createApiInstance';

const api = createApiInstance(`/v1/shop-coin`);

export const shopCoinAPI = {
  // Get current user's ShopCoins
  getMyShopCoins: async () => {
    try {
      const response = await api.get('/my-coins');
      return response.data;
    } catch (error) {
      console.error('Error fetching my shop coins:', error);
      throw error;
    }
  },

  // Get specific user's ShopCoins (admin only)
  getUserShopCoins: async (userId) => {
    try {
      const response = await api.get(`/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching shop coins for user ${userId}:`, error);
      throw error;
    }
  },

  // Daily check-in
  dailyCheckIn: async (bonusPoints = null) => {
    try {
      const payload = {};
      if (bonusPoints !== null) {
        payload.bonusPoints = bonusPoints;
      }
      const response = await api.post('/daily-check-in', payload);
      return response.data;
    } catch (error) {
      console.error('Error during daily check-in:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      throw error;
    }
  },

  // Add custom points
  addPoints: async (points, description = '') => {
    try {
      const response = await api.post('/add-points', {
        points,
        description,
      });
      return response.data;
    } catch (error) {
      console.error('Error adding points:', error);
      throw error;
    }
  },

  // Check if user has checked in today
  hasCheckedInToday: async () => {
    try {
      const response = await api.get('/check-in-status');
      return response.data;
    } catch (error) {
      console.error('Error checking in status:', error);
      throw error;
    }
  },

  getAllShopCoins: async (params = {}) => {
    try {
      const response = await api.get('/all', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching all shop coins:', error);
      throw error;
    }
  },

  // Mission Execution
  performViewProductMission: async () => {
    try {
      const response = await api.post('/mission/view-product');
      return response.data;
    } catch (error) {
      console.error('Error performing view product mission:', error);
      throw error;
    }
  },

  completeReviewMission: async (userId) => {
    try {
      // Pass userId as param
      const response = await api.post(`/mission/review-completion?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error completing review mission:', error);
      throw error;
    }
  },

  // --- Dynamic Mission System ---

  createMission: async (missionData) => {
    try {
      const response = await api.post('/missions', missionData);
      return response.data;
    } catch (error) {
      console.error('Error creating mission:', error);
      throw error;
    }
  },

  updateMission: async (id, missionData) => {
    try {
      const response = await api.put(`/missions/${id}`, missionData);
      return response.data;
    } catch (error) {
      console.error(`Error updating mission ${id}:`, error);
      throw error;
    }
  },

  deleteMission: async (id) => {
    try {
      await api.delete(`/missions/${id}`);
    } catch (error) {
      console.error(`Error deleting mission ${id}:`, error);
      throw error;
    }
  },

  getAllMissions: async () => {
    try {
      const response = await api.get('/missions');
      return response.data;
    } catch (error) {
      console.error('Error fetching all missions:', error);
      throw error;
    }
  },

  getMyMissions: async () => {
    try {
      const response = await api.get('/my-missions');
      return response.data;
    } catch (error) {
      console.error('Error fetching my missions:', error);
      throw error;
    }
  },

  performMissionAction: async (actionCode) => {
    try {
      const response = await api.post(`/missions/action/${actionCode}`);
      return response.data;
    } catch (error) {
      // Suppress error log if it's just "already completed" or allow UI to handle it
      throw error;
    }
  },

  claimMissionReward: async (missionId) => {
    try {
      const response = await api.post(`/missions/claim/${missionId}`);
      return response.data;
    } catch (error) {
      console.error(`Error claiming mission reward ${missionId}:`, error);
      throw error;
    }
  },
};

export default shopCoinAPI;
