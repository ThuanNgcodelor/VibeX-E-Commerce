import createApiInstance from "./createApiInstance";

const SHOP_COIN_API_URL = "/v1/user/shop-coin";

const shopCoinApi = createApiInstance(SHOP_COIN_API_URL);

/**
 * Add game reward to user wallet (now points to shop-coin)
 * @param {Object} data - { score: number }
 * @returns {Promise}
 */
export const addGameReward = async (data) => {
    try {
        const response = await shopCoinApi.post("/game-reward", data);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to add game reward");
    }
};
