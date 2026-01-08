import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/user/wallet";
const api = createApiInstance(API_URL);

export const getUserWallet = async () => {
    const response = await api.get("/balance");
    return response.data;
};

export const getWalletEntries = async (page, size) => {
    const response = await api.get(`/entries?page=${page}&size=${size}`);
    return response.data;
};

export const deposit = async (amount) => {
    const response = await api.post("/deposit", { amount });
    return response.data;
};

export const verifyDeposit = async (params) => {
    const response = await api.post("/deposit/verify", params);
    return response.data;
};

export const depositDirect = async (amount) => {
    const response = await api.post("/deposit/direct", { amount });
    return response.data;
};

export const withdraw = async (amount, bankAccount, bankName, accountHolder) => {
    const response = await api.post("/withdraw", { amount, bankAccount, bankName, accountHolder });
    return response.data;
};

// Bank Transfer (Simulated)
export const initiateBankTransfer = async (amount) => {
    const response = await api.post("/deposit/simulated", { amount });
    return response.data;
};

export const verifyBankTransfer = async (orderId, amount) => {
    const response = await api.post("/deposit/simulated/verify", { orderId, amount });
    return response.data;
};
